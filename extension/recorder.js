// Recordly Standalone Screen Recorder
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let startTime = 0;
let timerInterval = null;

const timerDisplay = document.getElementById("timer-display");
const statusText = document.getElementById("status-text");
const btnStop = document.getElementById("btn-stop");
const btnCancel = document.getElementById("btn-cancel");

function formatDuration(ms) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const mins = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

async function getEditorUrl() {
	const data = await chrome.storage.local.get("editorUrl");
	return data.editorUrl || "http://localhost:5173";
}

async function startCapture() {
	try {
		// Read user options from storage
		const settings = await chrome.storage.local.get(["micEnabled", "fps"]);
		const frameRate = parseInt(settings.fps, 10) || 60;

		mediaStream = await navigator.mediaDevices.getDisplayMedia({
			video: {
				frameRate,
			},
			audio: true,
		});

		// Check if microphone is requested
		let finalTracks = [...mediaStream.getVideoTracks()];

		if (settings.micEnabled) {
			try {
				const micStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
					},
				});

				const sysAudioTracks = mediaStream.getAudioTracks();
				if (sysAudioTracks.length > 0) {
					const audioCtx = new AudioContext();
					const dest = audioCtx.createMediaStreamDestination();

					const sysSource = audioCtx.createMediaStreamSource(new MediaStream(sysAudioTracks));
					const micSource = audioCtx.createMediaStreamSource(micStream);

					sysSource.connect(dest);
					micSource.connect(dest);

					finalTracks.push(...dest.stream.getAudioTracks());
				} else {
					finalTracks.push(...micStream.getAudioTracks());
				}
			} catch (micErr) {
				console.warn("Microphone access denied or unavailable:", micErr);
				finalTracks.push(...mediaStream.getAudioTracks());
			}
		} else {
			finalTracks.push(...mediaStream.getAudioTracks());
		}

		const combinedStream = new MediaStream(finalTracks);

		// Handle native Chrome "Stop sharing" bar click
		combinedStream.getVideoTracks()[0].addEventListener("ended", () => {
			stopAndSave();
		});

		let mimeType = "video/webm;codecs=vp9,opus";
		if (!MediaRecorder.isTypeSupported(mimeType)) {
			mimeType = "video/webm;codecs=vp8,opus";
			if (!MediaRecorder.isTypeSupported(mimeType)) {
				mimeType = "video/webm";
			}
		}

		mediaRecorder = new MediaRecorder(combinedStream, {
			mimeType,
			videoBitsPerSecond: 8000000,
		});

		mediaRecorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) recordedChunks.push(e.data);
		};

		mediaRecorder.start(1000);
		startTime = performance.now();

		timerInterval = setInterval(() => {
			const elapsed = performance.now() - startTime;
			timerDisplay.textContent = formatDuration(elapsed);
		}, 500);

		// Start tracking cursor across open tabs
		chrome.tabs.query({}, (tabs) => {
			for (const t of tabs) {
				if (t.id && t.url && !t.url.startsWith("chrome://")) {
					chrome.tabs.sendMessage(t.id, { type: "START_TRACKING", startTime }).catch(() => {});
				}
			}
		});

		// Notify extension background that recording is active
		chrome.runtime.sendMessage({ type: "RECORDER_PAGE_STARTED" });
	} catch (err) {
		console.warn("User cancelled or capture failed:", err);
		window.close();
	}
}

async function stopAndSave() {
	if (!mediaRecorder || mediaRecorder.state === "inactive") return;

	statusText.textContent = "Finalizing Video & Cursor Data...";
	btnStop.disabled = true;
	btnCancel.disabled = true;
	if (timerInterval) clearInterval(timerInterval);

	const durationMs = Math.round(performance.now() - startTime);

	// Collect cursor telemetry from content scripts
	let telemetryPoints = [];
	try {
		const allTabs = await chrome.tabs.query({});
		const results = await Promise.allSettled(
			allTabs.map((t) =>
				chrome.tabs.sendMessage(t.id, { type: "STOP_TRACKING" }).catch(() => null)
			)
		);
		let rawEvents = [];
		for (const r of results) {
			if (r.status === "fulfilled" && r.value && Array.isArray(r.value.events)) {
				rawEvents.push(...r.value.events);
			}
		}
		rawEvents.sort((a, b) => a.t - b.t);
		telemetryPoints = rawEvents.map((ev) => ({
			timeMs: ev.t,
			cx: Math.max(0, Math.min(1, ev.x)),
			cy: Math.max(0, Math.min(1, ev.y)),
			interactionType: ev.type === "click" || ev.type === "mousedown" ? "click" : "move",
			cursorType: "arrow",
		}));
	} catch (e) {
		console.warn("Failed collecting cursor telemetry:", e);
	}

	mediaRecorder.onstop = async () => {
		try {
			const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });

			if (mediaStream) {
				mediaStream.getTracks().forEach((t) => t.stop());
			}

			const editorUrl = await getEditorUrl();

			// Open Web Editor tab
			const tab = await chrome.tabs.create({ url: editorUrl });

			// Send recording data to editor tab once loaded
			const checkTabLoaded = (tabId, changeInfo) => {
				if (tabId === tab.id && changeInfo.status === "complete") {
					chrome.tabs.onUpdated.removeListener(checkTabLoaded);

					setTimeout(() => {
						const reader = new FileReader();
						reader.onloadend = async () => {
							const base64Data = reader.result;
							try {
								await chrome.scripting.executeScript({
									target: { tabId: tab.id },
									func: (base64, dur, events) => {
										fetch(base64)
											.then((res) => res.blob())
											.then((videoBlob) => {
												window.postMessage(
													{
														type: "RECORDLY_NEW_RECORDING",
														blob: videoBlob,
														fileName: `recording_${Date.now()}.webm`,
														telemetry: {
															events: events || [],
															durationMs: dur,
															metadata: { source: "chrome-extension" },
														},
													},
													"*"
												);
											});
									},
									args: [base64Data, durationMs, telemetryPoints],
								});
							} catch (e) {
								console.error("Failed to inject into editor:", e);
							} finally {
								window.close();
							}
						};
						reader.readAsDataURL(blob);
					}, 1200);
				}
			};

			chrome.tabs.onUpdated.addListener(checkTabLoaded);
		} catch (err) {
			console.error("Save failed:", err);
			alert("Error saving recording: " + err.message);
			window.close();
		}
	};

	mediaRecorder.stop();
}

btnStop.addEventListener("click", () => {
	stopAndSave();
});

btnCancel.addEventListener("click", () => {
	if (mediaStream) {
		mediaStream.getTracks().forEach((t) => t.stop());
	}
	window.close();
});

// Launch capture immediately on window open
startCapture();
