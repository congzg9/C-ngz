// Recordly Chrome Extension - Background Service Worker (Manifest V3)
let isRecording = false;
let recordingStartTime = 0;
let activeRecordingTabId = null;
let currentStreamId = null;

const DEFAULT_EDITOR_URL = "http://localhost:5173"; // Default local or Cloudflare Pages URL

async function getEditorUrl() {
	const data = await chrome.storage.local.get("editorUrl");
	return data.editorUrl || DEFAULT_EDITOR_URL;
}

// Ensure offscreen document exists
async function setupOffscreenDocument(path = "offscreen.html") {
	const contexts = await chrome.runtime.getContexts({
		contextTypes: ["OFFSCREEN_DOCUMENT"],
	});

	if (contexts.length > 0) {
		return;
	}

	await chrome.offscreen.createDocument({
		url: path,
		reasons: ["USER_MEDIA"],
		justification: "Recording screen and tab video streams",
	});
}

async function closeOffscreenDocument() {
	const contexts = await chrome.runtime.getContexts({
		contextTypes: ["OFFSCREEN_DOCUMENT"],
	});
	if (contexts.length > 0) {
		await chrome.offscreen.closeDocument();
	}
}

// Update Extension Action Badge
function updateBadge(recording) {
	if (recording) {
		chrome.action.setBadgeText({ text: "REC" });
		chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
	} else {
		chrome.action.setBadgeText({ text: "" });
	}
}

// Convert content telemetry into Recordly-compatible cursor telemetry format
function formatTelemetryForRecordly(rawEvents, durationMs) {
	if (!rawEvents || rawEvents.length === 0) {
		return {
			events: [],
			durationMs,
			metadata: { source: "chrome-extension" }
		};
	}

	const formatted = rawEvents.map((evt) => ({
		timeMs: evt.t,
		cx: evt.x,
		cy: evt.y,
		interactionType: evt.type === "click" || evt.type === "mousedown" ? "click" : "move"
	}));

	return {
		events: formatted,
		durationMs,
		metadata: {
			source: "chrome-extension",
			eventCount: formatted.length,
		}
	};
}

// Helper to open DB in background
function openRecordingDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("RecordlyExtensionDB", 1);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function getRecordingFromDB(id) {
	const db = await openRecordingDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction("recordings", "readonly");
		const store = tx.objectStore("recordings");
		const req = store.get(id);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

// Open Editor and deliver recording
async function openEditorWithRecording(recordingId, telemetry) {
	const editorUrl = await getEditorUrl();
	const recordingRecord = await getRecordingFromDB(recordingId);

	if (!recordingRecord || !recordingRecord.blob) {
		console.error("Recording not found in DB:", recordingId);
		return;
	}

	// Open Cloudflare Pages / Web Editor tab
	const tab = await chrome.tabs.create({ url: editorUrl });

	// Wait for tab to load, then send data
	const checkTabLoaded = (tabId, changeInfo) => {
		if (tabId === tab.id && changeInfo.status === "complete") {
			chrome.tabs.onUpdated.removeListener(checkTabLoaded);

			// Inject recording into the web page
			setTimeout(async () => {
				try {
					// Use BroadcastChannel to pass Blob safely to same origin or tab message
					const reader = new FileReader();
					reader.onloadend = async () => {
						const base64Data = reader.result;

						// Execute script in the editor tab to postMessage to webAdapter
						await chrome.scripting.executeScript({
							target: { tabId: tab.id },
							func: (base64, telemetryData) => {
								fetch(base64)
									.then((res) => res.blob())
									.then((blob) => {
										window.postMessage(
											{
												type: "RECORDLY_NEW_RECORDING",
												blob,
												fileName: `recording_${Date.now()}.webm`,
												telemetry: telemetryData,
											},
											"*"
										);
									});
							},
							args: [base64Data, telemetry],
						});
					};
					reader.readAsDataURL(recordingRecord.blob);
				} catch (err) {
					console.error("Failed to inject recording to editor:", err);
				}
			}, 1000);
		}
	};

	chrome.tabs.onUpdated.addListener(checkTabLoaded);
}

// Stop current recording flow
async function handleStopRecording() {
	if (!isRecording) return { success: false, error: "Not recording" };

	isRecording = false;
	updateBadge(false);

	// Stop telemetry collection on active tab
	let rawTelemetry = [];
	if (activeRecordingTabId) {
		try {
			const res = await chrome.tabs.sendMessage(activeRecordingTabId, {
				type: "STOP_TRACKING",
			});
			if (res && res.events) {
				rawTelemetry = res.events;
			}
		} catch (e) {
			console.warn("Could not retrieve telemetry from tab:", e);
		}
	}

	// Stop offscreen recording
	const offscreenRes = await chrome.runtime.sendMessage({
		target: "offscreen",
		type: "STOP_RECORDING",
	});

	if (offscreenRes && offscreenRes.success) {
		const durationMs = offscreenRes.durationMs || (Date.now() - recordingStartTime);
		const telemetry = formatTelemetryForRecordly(rawTelemetry, durationMs);

		// Open editor and transfer video + telemetry
		await openEditorWithRecording(offscreenRes.recordingId, telemetry);

		return {
			success: true,
			recordingId: offscreenRes.recordingId,
			durationMs,
		};
	}

	return { success: false, error: offscreenRes?.error || "Stop failed" };
}

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "GET_RECORDING_STATUS") {
		sendResponse({
			isRecording,
			startTime: recordingStartTime,
		});
		return true;
	}

	if (message.type === "START_RECORDING_WITH_STREAM") {
		(async () => {
			try {
				await setupOffscreenDocument();

				currentStreamId = message.streamId;
				activeRecordingTabId = message.activeTabId || null;
				recordingStartTime = performance.now();

				// Start offscreen recorder with the provided streamId
				const offscreenRes = await chrome.runtime.sendMessage({
					target: "offscreen",
					type: "START_RECORDING",
					streamId: message.streamId,
					options: message.options || { mic: true, frameRate: 60 },
				});

				if (offscreenRes && offscreenRes.success) {
					isRecording = true;
					updateBadge(true);

					// Start cursor tracking on active tab
					if (activeRecordingTabId && message.options?.telemetry) {
						chrome.tabs.sendMessage(activeRecordingTabId, {
							type: "START_TRACKING",
							startTime: offscreenRes.startTime,
						}).catch(() => {});
					}

					sendResponse({ success: true, startTime: offscreenRes.startTime });
				} else {
					sendResponse({
						success: false,
						error: offscreenRes?.error || "Could not start offscreen recorder",
					});
				}
			} catch (err) {
				sendResponse({ success: false, error: err.message });
			}
		})();
		return true;
	}

	if (message.type === "START_DESKTOP_CAPTURE") {
		(async () => {
			try {
				await setupOffscreenDocument();

				// Get current active tab for cursor tracking
				const [activeTab] = await chrome.tabs.query({
					active: true,
					lastFocusedWindow: true,
				});
				activeRecordingTabId = activeTab ? activeTab.id : null;

				// Request screen / window / tab picker
				chrome.desktopCapture.chooseDesktopMedia(
					["screen", "window", "tab"],
					async (streamId) => {
						if (!streamId) {
							sendResponse({ success: false, error: "Permission denied or canceled" });
							return;
						}

						currentStreamId = streamId;
						recordingStartTime = performance.now();

						// Start offscreen recorder
						const offscreenRes = await chrome.runtime.sendMessage({
							target: "offscreen",
							type: "START_RECORDING",
							streamId,
							options: message.options || { mic: true, frameRate: 60 },
						});

						if (offscreenRes && offscreenRes.success) {
							isRecording = true;
							updateBadge(true);

							// Start cursor tracking on active tab
							if (activeRecordingTabId) {
								chrome.tabs.sendMessage(activeRecordingTabId, {
									type: "START_TRACKING",
									startTime: offscreenRes.startTime,
								}).catch(() => {});
							}

							sendResponse({ success: true, startTime: offscreenRes.startTime });
						} else {
							sendResponse({ success: false, error: offscreenRes?.error });
						}
					}
				);
			} catch (err) {
				sendResponse({ success: false, error: err.message });
			}
		})();
		return true;
	}

	if (message.type === "STOP_RECORDING_REQUEST") {
		handleStopRecording()
			.then((res) => sendResponse(res))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true;
	}

	if (message.type === "USER_STOPPED_SCREEN_SHARE") {
		handleStopRecording();
		return true;
	}
});
