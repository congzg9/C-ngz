// Recordly Chrome Extension - Content Script for Cursor & Interaction Telemetry
let isTracking = false;
let startTime = 0;
let telemetryEvents = [];
let sampleInterval = 16; // ~60fps throttle for cursor movements
let lastSampleTime = 0;

function getRelativeTime() {
	return performance.now() - startTime;
}

function handleMouseMove(e) {
	if (!isTracking) return;
	const now = performance.now();
	if (now - lastSampleTime < sampleInterval) return;
	lastSampleTime = now;

	const x = e.clientX / window.innerWidth;
	const y = e.clientY / window.innerHeight;

	telemetryEvents.push({
		t: Math.round(getRelativeTime()),
		x: Number(x.toFixed(5)),
		y: Number(y.toFixed(5)),
		type: "move",
		target: (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "unknown"
	});
}

function handleMouseDown(e) {
	if (!isTracking) return;
	const x = e.clientX / window.innerWidth;
	const y = e.clientY / window.innerHeight;

	telemetryEvents.push({
		t: Math.round(getRelativeTime()),
		x: Number(x.toFixed(5)),
		y: Number(y.toFixed(5)),
		type: "mousedown",
		button: e.button
	});
}

function handleMouseUp(e) {
	if (!isTracking) return;
	const x = e.clientX / window.innerWidth;
	const y = e.clientY / window.innerHeight;

	telemetryEvents.push({
		t: Math.round(getRelativeTime()),
		x: Number(x.toFixed(5)),
		y: Number(y.toFixed(5)),
		type: "mouseup",
		button: e.button
	});
}

function handleClick(e) {
	if (!isTracking) return;
	const x = e.clientX / window.innerWidth;
	const y = e.clientY / window.innerHeight;

	telemetryEvents.push({
		t: Math.round(getRelativeTime()),
		x: Number(x.toFixed(5)),
		y: Number(y.toFixed(5)),
		type: "click",
		button: e.button
	});
}

function handleWheel(e) {
	if (!isTracking) return;
	const x = e.clientX / window.innerWidth;
	const y = e.clientY / window.innerHeight;

	telemetryEvents.push({
		t: Math.round(getRelativeTime()),
		x: Number(x.toFixed(5)),
		y: Number(y.toFixed(5)),
		type: "wheel",
		deltaY: Math.sign(e.deltaY)
	});
}

function startTracking(recordingStartTime) {
	isTracking = true;
	startTime = recordingStartTime || performance.now();
	telemetryEvents = [];
	lastSampleTime = 0;

	window.addEventListener("mousemove", handleMouseMove, { passive: true, capture: true });
	window.addEventListener("mousedown", handleMouseDown, { passive: true, capture: true });
	window.addEventListener("mouseup", handleMouseUp, { passive: true, capture: true });
	window.addEventListener("click", handleClick, { passive: true, capture: true });
	window.addEventListener("wheel", handleWheel, { passive: true, capture: true });
}

function stopTracking() {
	if (!isTracking) return telemetryEvents;
	isTracking = false;

	window.removeEventListener("mousemove", handleMouseMove, { capture: true });
	window.removeEventListener("mousedown", handleMouseDown, { capture: true });
	window.removeEventListener("mouseup", handleMouseUp, { capture: true });
	window.removeEventListener("click", handleClick, { capture: true });
	window.removeEventListener("wheel", handleWheel, { capture: true });

	return telemetryEvents;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "START_TRACKING") {
		startTracking(message.startTime);
		sendResponse({ success: true });
		return true;
	}

	if (message.type === "STOP_TRACKING") {
		const events = stopTracking();
		sendResponse({ success: true, events });
		return true;
	}

	if (message.type === "INJECT_RECORDING_TO_PAGE") {
		// When opening editor, this injects recording data into the web application
		window.postMessage({
			type: "RECORDLY_NEW_RECORDING",
			blob: message.blob,
			fileName: message.fileName,
			telemetry: message.telemetry
		}, "*");
		sendResponse({ success: true });
		return true;
	}
});
