// Recordly Chrome Extension - Offscreen Media Recorder
let mediaRecorder = null;
let recordedChunks = [];
let mediaStream = null;
let micStream = null;
let audioContext = null;
let startTime = 0;
let endTime = 0;

// Setup IndexedDB in extension origin for transferring large recorded videos smoothly
function openRecordingDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("RecordlyExtensionDB", 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains("recordings")) {
				db.createObjectStore("recordings", { keyPath: "id" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function saveRecordingToDB(id, blob, metadata) {
	const db = await openRecordingDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction("recordings", "readwrite");
		const store = tx.objectStore("recordings");
		store.put({ id, blob, metadata, createdAt: Date.now() });
		tx.oncomplete = () => resolve(true);
		tx.onerror = () => reject(tx.error);
	});
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.target !== "offscreen") return;

	if (message.type === "START_RECORDING") {
		startRecording(message.streamId, message.options)
			.then((res) => sendResponse(res))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true;
	}

	if (message.type === "STOP_RECORDING") {
		stopRecording()
			.then((res) => sendResponse(res))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true;
	}
});

async function startRecording(streamId, options = {}) {
	recordedChunks = [];
	startTime = performance.now();

	const constraints = {
		audio: {
			mandatory: {
				chromeMediaSource: "desktop",
				chromeMediaSourceId: streamId,
			},
		},
		video: {
			mandatory: {
				chromeMediaSource: "desktop",
				chromeMediaSourceId: streamId,
				maxFrameRate: options.frameRate || 60,
			},
		},
	};

	try {
		mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
	} catch (err) {
		// Fallback without system audio if permissions reject audio track
		constraints.audio = false;
		mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
	}

	// Mix Microphone if enabled
	let finalTracks = [...mediaStream.getVideoTracks()];

	if (options.mic) {
		try {
			micStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			const systemAudioTracks = mediaStream.getAudioTracks();
			if (systemAudioTracks.length > 0) {
				audioContext = new AudioContext();
				const dest = audioContext.createMediaStreamDestination();

				const sysSource = audioContext.createMediaStreamSource(new MediaStream(systemAudioTracks));
				const micSource = audioContext.createMediaStreamSource(micStream);

				sysSource.connect(dest);
				micSource.connect(dest);

				finalTracks.push(...dest.stream.getAudioTracks());
			} else {
				finalTracks.push(...micStream.getAudioTracks());
			}
		} catch (micErr) {
			console.warn("Could not access microphone:", micErr);
			// Fallback to whatever system audio exists
			finalTracks.push(...mediaStream.getAudioTracks());
		}
	} else {
		finalTracks.push(...mediaStream.getAudioTracks());
	}

	const combinedStream = new MediaStream(finalTracks);

	// Handle native Chrome "Stop sharing" button click
	combinedStream.getVideoTracks()[0].addEventListener("ended", () => {
		chrome.runtime.sendMessage({
			type: "USER_STOPPED_SCREEN_SHARE",
		});
	});

	// Choose supported high quality mime type
	let mimeType = "video/webm;codecs=vp9,opus";
	if (!MediaRecorder.isTypeSupported(mimeType)) {
		mimeType = "video/webm;codecs=vp8,opus";
		if (!MediaRecorder.isTypeSupported(mimeType)) {
			mimeType = "video/webm";
		}
	}

	mediaRecorder = new MediaRecorder(combinedStream, {
		mimeType,
		videoBitsPerSecond: options.videoBitsPerSecond || 8000000, // 8 Mbps
	});

	mediaRecorder.ondataavailable = (e) => {
		if (e.data && e.data.size > 0) {
			recordedChunks.push(e.data);
		}
	};

	mediaRecorder.start(1000); // 1s slices for smooth chunk collection

	return { success: true, startTime };
}

async function stopRecording() {
	return new Promise((resolve, reject) => {
		if (!mediaRecorder || mediaRecorder.state === "inactive") {
			resolve({ success: false, error: "Recorder is not active" });
			return;
		}

		endTime = performance.now();
		const durationMs = Math.round(endTime - startTime);

		mediaRecorder.onstop = async () => {
			try {
				const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
				const recordingId = "rec_" + Date.now();

				// Save into extension indexedDB
				await saveRecordingToDB(recordingId, blob, {
					durationMs,
					mimeType: blob.type,
					size: blob.size,
				});

				// Cleanup streams
				if (mediaStream) {
					mediaStream.getTracks().forEach((t) => t.stop());
					mediaStream = null;
				}
				if (micStream) {
					micStream.getTracks().forEach((t) => t.stop());
					micStream = null;
				}
				if (audioContext && audioContext.state !== "closed") {
					audioContext.close();
					audioContext = null;
				}

				resolve({
					success: true,
					recordingId,
					durationMs,
					size: blob.size,
				});
			} catch (err) {
				reject(err);
			}
		};

		mediaRecorder.stop();
	});
}
