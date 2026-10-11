// Recordly Chrome Extension - Popup Interaction Logic
const statusIndicator = document.getElementById("status-indicator");
const statusText = document.getElementById("status-text");
const timerBox = document.getElementById("timer-box");
const timerText = document.getElementById("timer-text");
const optionsGroup = document.getElementById("options-group");
const micToggle = document.getElementById("mic-toggle");
const telemetryToggle = document.getElementById("telemetry-toggle");
const fpsSelect = document.getElementById("fps-select");
const editorUrlInput = document.getElementById("editor-url-input");
const btnRecord = document.getElementById("btn-record");
const btnRecordText = document.getElementById("btn-record-text");
const btnOpenEditor = document.getElementById("btn-open-editor");
const toggleSettingsBtn = document.getElementById("toggle-settings-btn");
const settingsBody = document.getElementById("settings-body");

let timerInterval = null;
let recordingStartTime = 0;
let isCurrentlyRecording = false;

// Format milliseconds into MM:SS
function formatDuration(ms) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const mins = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function startTimer(startTime) {
	recordingStartTime = startTime;
	updateTimerDisplay();
	if (timerInterval) clearInterval(timerInterval);
	timerInterval = setInterval(updateTimerDisplay, 500);
}

function stopTimer() {
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}
	timerBox.classList.add("hidden");
}

function updateTimerDisplay() {
	const elapsed = performance.now() - recordingStartTime;
	timerText.textContent = formatDuration(elapsed);
}

// Update UI to recording state
function setRecordingUI(recording, startTime) {
	isCurrentlyRecording = recording;
	if (recording) {
		statusIndicator.classList.add("recording");
		statusText.textContent = "Recording";
		timerBox.classList.remove("hidden");
		btnRecord.classList.add("recording");
		btnRecordText.textContent = "Stop Recording";
		startTimer(startTime);
	} else {
		statusIndicator.classList.remove("recording");
		statusText.textContent = "Ready";
		timerBox.classList.add("hidden");
		btnRecord.classList.remove("recording");
		btnRecordText.textContent = "Start Recording";
		stopTimer();
	}
}

// Load saved settings
async function loadSettings() {
	const data = await chrome.storage.local.get([
		"micEnabled",
		"telemetryEnabled",
		"fps",
		"editorUrl",
	]);

	if (data.micEnabled !== undefined) micToggle.checked = data.micEnabled;
	if (data.telemetryEnabled !== undefined) telemetryToggle.checked = data.telemetryEnabled;
	if (data.fps !== undefined) fpsSelect.value = data.fps;
	editorUrlInput.value = data.editorUrl || "http://localhost:5173";
}

// Save settings on change
function setupSettingsListeners() {
	micToggle.addEventListener("change", () => {
		chrome.storage.local.set({ micEnabled: micToggle.checked });
	});
	telemetryToggle.addEventListener("change", () => {
		chrome.storage.local.set({ telemetryEnabled: telemetryToggle.checked });
	});
	fpsSelect.addEventListener("change", () => {
		chrome.storage.local.set({ fps: fpsSelect.value });
	});
	editorUrlInput.addEventListener("input", () => {
		chrome.storage.local.set({ editorUrl: editorUrlInput.value.trim() });
	});

	toggleSettingsBtn.addEventListener("click", () => {
		const isVisible = settingsBody.style.display !== "none";
		settingsBody.style.display = isVisible ? "none" : "flex";
	});
}

// Query initial status from background
async function checkRecordingStatus() {
	chrome.runtime.sendMessage({ type: "GET_RECORDING_STATUS" }, (response) => {
		if (response && response.isRecording) {
			setRecordingUI(true, response.startTime);
		} else {
			setRecordingUI(false);
		}
	});
}

// Start or stop recording
btnRecord.addEventListener("click", async () => {
	if (!isCurrentlyRecording) {
		// Open dedicated recorder window (guaranteed 100% to trigger screen capture picker)
		chrome.windows.create({
			url: chrome.runtime.getURL("recorder.html"),
			type: "popup",
			width: 440,
			height: 320,
			focused: true,
		});
		window.close();
	} else {
		// Stop recording
		btnRecord.disabled = true;
		btnRecordText.textContent = "Finalizing & Opening Editor...";

		chrome.runtime.sendMessage({ type: "STOP_RECORDING_REQUEST" }, (response) => {
			btnRecord.disabled = false;
			setRecordingUI(false);
			if (response && response.success) {
				window.close();
			} else {
				alert(response?.error || "Failed to stop recording");
			}
		});
	}
});

// Open Editor button
btnOpenEditor.addEventListener("click", () => {
	const url = editorUrlInput.value.trim() || "http://localhost:5173";
	chrome.tabs.create({ url });
	window.close();
});

// Initialize
loadSettings();
setupSettingsListeners();
checkRecordingStatus();
