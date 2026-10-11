/**
 * Web Adapter for Recordly Video Editor.
 * Replaces Electron IPC APIs with browser-native Web APIs (File System Access, IndexedDB, Object URLs, Downloads)
 * when running as a web app on Cloudflare Pages or any static web host.
 */

import type { CursorTelemetryPoint } from "@/components/video-editor/types";
import { fixWebmDuration } from "@fix-webm-duration/fix";

const DB_NAME = "recordly_web_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
	if (!dbPromise) {
		dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains("projects")) {
					db.createObjectStore("projects", { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains("media")) {
					db.createObjectStore("media", { keyPath: "path" });
				}
				if (!db.objectStoreNames.contains("telemetry")) {
					db.createObjectStore("telemetry", { keyPath: "path" });
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}
	return dbPromise;
}

// In-memory media cache for fast blob URLs
const mediaObjectUrls = new Map<string, string>();
const inMemoryTelemetry = new Map<string, CursorTelemetryPoint[]>();

let currentVideoPathState: string | null = null;
let currentRecordingSessionState: {
	videoPath: string;
	webcamPath?: string | null;
	timeOffsetMs?: number;
	hideOverlayCursorByDefault?: boolean;
} | null = null;

const recordingSessionListeners = new Set<(session: typeof currentRecordingSessionState) => void>();

export function notifyRecordingSessionChanged(session: typeof currentRecordingSessionState) {
	currentRecordingSessionState = session;
	for (const listener of recordingSessionListeners) {
		try {
			listener(session);
		} catch (err) {
			console.error("Recording session listener error:", err);
		}
	}
}

function getBlobDuration(blob: Blob): Promise<number> {
	return new Promise((resolve) => {
		const tempVideo = document.createElement("video");
		tempVideo.preload = "metadata";
		const tempUrl = URL.createObjectURL(blob);
		tempVideo.src = tempUrl;
		tempVideo.onloadedmetadata = () => {
			if (Number.isFinite(tempVideo.duration) && tempVideo.duration > 0) {
				const ms = Math.round(tempVideo.duration * 1000);
				URL.revokeObjectURL(tempUrl);
				resolve(ms);
			} else {
				tempVideo.ontimeupdate = () => {
					tempVideo.ontimeupdate = null;
					const dur = tempVideo.duration;
					URL.revokeObjectURL(tempUrl);
					resolve(Number.isFinite(dur) && dur > 0 ? Math.round(dur * 1000) : 5000);
				};
				tempVideo.currentTime = 1e101;
			}
		};
		tempVideo.onerror = () => {
			URL.revokeObjectURL(tempUrl);
			resolve(5000);
		};
	});
}

/**
 * Register media Blob in memory and IndexedDB, returning a synthetic file path and blob URL.
 */
export async function registerWebMedia(
	blob: Blob,
	fileName: string,
	telemetryData?: CursorTelemetryPoint[] | { events?: CursorTelemetryPoint[]; durationMs?: number },
): Promise<{ path: string; url: string }> {
	let finalBlob = blob;
	let telemetryPoints: CursorTelemetryPoint[] = [];
	let durationMs = 0;

	if (Array.isArray(telemetryData)) {
		telemetryPoints = telemetryData;
	} else if (telemetryData && typeof telemetryData === "object") {
		if (Array.isArray(telemetryData.events)) {
			telemetryPoints = telemetryData.events;
		}
		if (typeof telemetryData.durationMs === "number" && telemetryData.durationMs > 0) {
			durationMs = telemetryData.durationMs;
		}
	}

	// Fix WebM infinite duration header produced by Chrome MediaRecorder
	if (finalBlob.type.includes("webm")) {
		if (!durationMs || durationMs <= 0) {
			durationMs = await getBlobDuration(finalBlob);
		}
		if (durationMs > 0) {
			try {
				finalBlob = await fixWebmDuration(finalBlob, durationMs);
			} catch (err) {
				console.warn("Could not fix WebM duration:", err);
			}
		}
	}

	const path = `web-media://${Date.now()}-${fileName}`;
	const url = URL.createObjectURL(finalBlob);
	mediaObjectUrls.set(path, url);

	if (telemetryPoints.length > 0) {
		inMemoryTelemetry.set(path, telemetryPoints);
	}

	try {
		const db = await getDb();
		const tx = db.transaction(["media", "telemetry"], "readwrite");
		tx.objectStore("media").put({ path, blob: finalBlob, fileName, createdAt: Date.now() });
		if (telemetryPoints.length > 0) {
			tx.objectStore("telemetry").put({ path, samples: telemetryPoints });
		}
	} catch (err) {
		console.warn("Could not persist media to IndexedDB:", err);
	}

	return { path, url };
}

/**
 * Pick a video file from user's machine using File System Access API or input element.
 */
export function pickVideoFile(): Promise<{ file: File; url: string; path: string } | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.accept = "video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv,.json";
		input.onchange = async () => {
			const files = Array.from(input.files || []);
			if (files.length === 0) {
				resolve(null);
				return;
			}
			const videoFile = files.find((f) => /\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(f.name)) || files[0];
			const telemetryFile = files.find((f) => /\.json$/i.test(f.name));

			let telemetryData: CursorTelemetryPoint[] | undefined;
			if (telemetryFile) {
				try {
					const text = await telemetryFile.text();
					const parsed = JSON.parse(text);
					telemetryData = Array.isArray(parsed) ? parsed : parsed?.samples;
				} catch (err) {
					console.warn("Could not parse selected telemetry file:", err);
				}
			}

			const registered = await registerWebMedia(videoFile, videoFile.name, telemetryData);
			resolve({ file: videoFile, url: registered.url, path: registered.path });
		};
		input.oncancel = () => resolve(null);
		input.click();
	});
}

/**
 * Pick an audio file from user's machine.
 */
export function pickAudioFile(): Promise<{ file: File; url: string; path: string } | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/mp3,audio/wav,audio/aac,audio/m4a,audio/webm,.mp3,.wav,.aac,.m4a";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			const registered = await registerWebMedia(file, file.name);
			resolve({ file, url: registered.url, path: registered.path });
		};
		input.oncancel = () => resolve(null);
		input.click();
	});
}

/**
 * Download exported video file to user's computer.
 */
export function downloadFile(data: ArrayBuffer | Blob, fileName: string): boolean {
	try {
		const blob = data instanceof Blob ? data : new Blob([data]);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 2000);
		return true;
	} catch (err) {
		console.error("Failed to download exported video:", err);
		return false;
	}
}

/**
 * Record screen directly in the browser using standard Web getDisplayMedia API.
 */
export async function recordBrowserScreen(): Promise<{ success: boolean; path?: string; error?: string }> {
	try {
		const stream = await navigator.mediaDevices.getDisplayMedia({
			video: {
				frameRate: 60,
			},
			audio: true,
		});

		const chunks: Blob[] = [];
		const startTime = performance.now();
		const telemetry: CursorTelemetryPoint[] = [];

		let mimeType = "video/webm;codecs=vp9,opus";
		if (!MediaRecorder.isTypeSupported(mimeType)) {
			mimeType = "video/webm;codecs=vp8,opus";
			if (!MediaRecorder.isTypeSupported(mimeType)) {
				mimeType = "video/webm";
			}
		}

		let lastSampleTime = 0;
		const handlePointerMove = (e: MouseEvent) => {
			const now = performance.now();
			if (now - lastSampleTime < 16) return;
			lastSampleTime = now;
			const timeMs = Math.round(now - startTime);
			const cx = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
			const cy = Math.max(0, Math.min(1, e.clientY / window.innerHeight));
			telemetry.push({
				timeMs,
				cx,
				cy,
				interactionType: "move",
				cursorType: "arrow",
			});
		};

		const handlePointerDown = (e: MouseEvent) => {
			const now = performance.now();
			const timeMs = Math.round(now - startTime);
			const cx = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
			const cy = Math.max(0, Math.min(1, e.clientY / window.innerHeight));
			telemetry.push({
				timeMs,
				cx,
				cy,
				interactionType: "click",
				cursorType: "arrow",
			});
		};

		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		window.addEventListener("pointerdown", handlePointerDown, { passive: true });

		const recorder = new MediaRecorder(stream, { mimeType });

		recorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) chunks.push(e.data);
		};

		const recordingPromise = new Promise<{ success: boolean; path?: string; error?: string }>((resolve) => {
			recorder.onstop = async () => {
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerdown", handlePointerDown);
				try {
					const blob = new Blob(chunks, { type: mimeType });
					stream.getTracks().forEach((t) => t.stop());
					const fileName = `web_recording_${Date.now()}.webm`;
					const registered = await registerWebMedia(blob, fileName, {
						events: telemetry,
						durationMs: Math.round(performance.now() - startTime),
					});
					currentVideoPathState = registered.path;
					notifyRecordingSessionChanged({ videoPath: registered.path });
					resolve({ success: true, path: registered.path });
				} catch (err) {
					resolve({ success: false, error: (err as Error).message });
				}
			};
		});

		recorder.start(1000);

		// Stop when user clicks native Chrome "Stop sharing" bar
		const videoTrack = stream.getVideoTracks()[0];
		if (videoTrack) {
			videoTrack.addEventListener("ended", () => {
				if (recorder.state !== "inactive") {
					recorder.stop();
				}
			});
		}

		return await recordingPromise;
	} catch (err) {
		console.warn("Browser screen recording canceled or failed:", err);
		return { success: false, error: (err as Error).message };
	}
}

function generateFallbackTelemetry(durationMs: number = 3600000): CursorTelemetryPoint[] {
	const points: CursorTelemetryPoint[] = [];
	const step = 150;
	const total = Math.max(durationMs, 600000);
	for (let t = 0; t <= total; t += step) {
		const angle = (t / 4500) * Math.PI * 2;
		const cx = 0.5 + 0.18 * Math.cos(angle) + 0.04 * Math.sin(angle * 2.5);
		const cy = 0.45 + 0.12 * Math.sin(angle * 1.3) + 0.03 * Math.cos(angle * 3.1);
		points.push({
			timeMs: t,
			cx: Number(Math.max(0.08, Math.min(0.92, cx)).toFixed(4)),
			cy: Number(Math.max(0.08, Math.min(0.92, cy)).toFixed(4)),
			interactionType: t > 0 && t % 3000 === 0 ? "click" : "move",
			cursorType: "arrow",
		});
	}
	return points;
}

/**
 * Build the full web-compatible electronAPI replacement.
 */
export function createWebElectronAPI() {
	return {
		isElectron: false,
		isWeb: true,

		openVideoFilePicker: async () => {
			const result = await pickVideoFile();
			if (!result) {
				return { canceled: true, success: false };
			}
			currentVideoPathState = result.path;
			notifyRecordingSessionChanged({ videoPath: result.path });
			return {
				canceled: false,
				success: true,
				filePath: result.path,
				url: result.url,
			};
		},

		openAudioFilePicker: async () => {
			const result = await pickAudioFile();
			if (!result) {
				return { canceled: true, success: false };
			}
			return {
				canceled: false,
				success: true,
				filePath: result.path,
				url: result.url,
			};
		},

		saveExportedVideo: async (videoData: ArrayBuffer, fileName: string) => {
			const success = downloadFile(videoData, fileName);
			return { success, path: fileName };
		},

		writeExportedVideoToPath: async (videoData: ArrayBuffer, outputPath: string) => {
			const fileName = outputPath.split(/[/\\]/).pop() || "exported-video.mp4";
			const success = downloadFile(videoData, fileName);
			return { success, path: fileName };
		},

		getLocalMediaUrl: async (filePath: string) => {
			const inMemUrl = mediaObjectUrls.get(filePath);
			if (inMemUrl) {
				return { success: true, url: inMemUrl };
			}

			// Try retrieving from IndexedDB
			try {
				const db = await getDb();
				const tx = db.transaction("media", "readonly");
				const record = await new Promise<{ blob: Blob } | null>((res) => {
					const req = tx.objectStore("media").get(filePath);
					req.onsuccess = () => res(req.result);
					req.onerror = () => res(null);
				});
				if (record?.blob) {
					const url = URL.createObjectURL(record.blob);
					mediaObjectUrls.set(filePath, url);
					return { success: true, url };
				}
			} catch (err) {
				console.warn("Error reading media from IndexedDB:", err);
			}

			// If filePath is already an HTTP / blob URL, return it
			if (filePath.startsWith("blob:") || filePath.startsWith("http:") || filePath.startsWith("https:")) {
				return { success: true, url: filePath };
			}

			return { success: false };
		},

		getVideoAudioFallbackPaths: async () => ({
			success: true,
			paths: [],
			startDelayMsByPath: {},
		}),

		getCurrentVideoPath: async () => {
			if (currentVideoPathState) {
				return { success: true, path: currentVideoPathState };
			}
			return { success: false, path: null };
		},
		setCurrentVideoPath: async (path: string) => {
			currentVideoPathState = path;
			return { success: true };
		},
		clearCurrentVideoPath: async () => {
			currentVideoPathState = null;
			return { success: true };
		},

		getCurrentRecordingSession: async () => {
			if (currentRecordingSessionState) {
				return { success: true, session: currentRecordingSessionState };
			}
			return { success: false, session: null };
		},
		setCurrentRecordingSession: async (session: {
			videoPath: string;
			webcamPath?: string | null;
			timeOffsetMs?: number;
			hideOverlayCursorByDefault?: boolean;
		}) => {
			currentRecordingSessionState = session;
			notifyRecordingSessionChanged(session);
			return { success: true };
		},
		onRecordingSessionChanged: (callback: (session: typeof currentRecordingSessionState) => void) => {
			recordingSessionListeners.add(callback);
			return () => {
				recordingSessionListeners.delete(callback);
			};
		},

		getCursorTelemetry: async (videoPath?: string) => {
			const targetPath = videoPath || currentVideoPathState || "";
			let samples: CursorTelemetryPoint[] = [];

			if (targetPath) {
				const inMem = inMemoryTelemetry.get(targetPath);
				if (inMem && inMem.length > 0) {
					samples = inMem;
				} else {
					try {
						const db = await getDb();
						const tx = db.transaction("telemetry", "readonly");
						const record = await new Promise<{ samples: CursorTelemetryPoint[] } | null>((res) => {
							const req = tx.objectStore("telemetry").get(targetPath);
							req.onsuccess = () => res(req.result);
							req.onerror = () => res(null);
						});
						if (record?.samples && record.samples.length > 0) {
							samples = record.samples;
							inMemoryTelemetry.set(targetPath, samples);
						}
					} catch {
						// ignore
					}
				}
			}

			// If no telemetry exists (e.g. video recorded without cursor hook or uploaded MP4),
			// provide smooth fallback telemetry so custom cursor styles (Gradient, macOS, Neon...)
			// render beautifully on preview and sync immediately with sidebar controls.
			if (samples.length === 0) {
				samples = generateFallbackTelemetry();
				if (targetPath) {
					inMemoryTelemetry.set(targetPath, samples);
				}
			}

			return {
				success: true,
				samples,
			};
		},
		setCursorTelemetry: async (videoPath: string | undefined, samples: CursorTelemetryPoint[]) => {
			if (videoPath) {
				inMemoryTelemetry.set(videoPath, samples);
				try {
					const db = await getDb();
					const tx = db.transaction("telemetry", "readwrite");
					tx.objectStore("telemetry").put({ path: videoPath, samples });
				} catch {
					// ignore
				}
			}
			return { success: true };
		},

		// Project Management via IndexedDB & JSON files
		saveProjectFile: async (
			projectData: unknown,
			suggestedName = "recordly-project",
			existingProjectPath?: string,
			thumbnailDataUrl?: string | null,
		) => {
			try {
				const id = existingProjectPath || `proj_${Date.now()}`;
				const entry = {
					id,
					path: id,
					name: suggestedName,
					projectData,
					thumbnailDataUrl: thumbnailDataUrl || null,
					updatedAt: Date.now(),
				};
				const db = await getDb();
				const tx = db.transaction("projects", "readwrite");
				tx.objectStore("projects").put(entry);

				return { success: true, path: id, projectId: id };
			} catch (err) {
				return { success: false, message: (err as Error).message };
			}
		},

		saveProjectFileNamed: async (
			projectData: unknown,
			projectName: string,
			thumbnailDataUrl?: string | null,
		) => {
			try {
				const id = `proj_${Date.now()}`;
				const entry = {
					id,
					path: id,
					name: projectName,
					projectData,
					thumbnailDataUrl: thumbnailDataUrl || null,
					updatedAt: Date.now(),
				};
				const db = await getDb();
				const tx = db.transaction("projects", "readwrite");
				tx.objectStore("projects").put(entry);

				return { success: true, path: id, projectId: id };
			} catch (err) {
				return { success: false, message: (err as Error).message };
			}
		},

		listProjectFiles: async () => {
			try {
				const db = await getDb();
				const tx = db.transaction("projects", "readonly");
				const records = await new Promise<Array<{ id: string; name: string; thumbnailDataUrl?: string; updatedAt: number }>>((res) => {
					const req = tx.objectStore("projects").getAll();
					req.onsuccess = () => res(req.result || []);
					req.onerror = () => res([]);
				});
				const entries = records.map((r) => ({
					path: r.id,
					name: r.name,
					thumbnailUrl: r.thumbnailDataUrl || null,
					updatedAt: r.updatedAt,
				}));
				return { success: true, entries };
			} catch (err) {
				return { success: false, error: (err as Error).message, entries: [] };
			}
		},

		openProjectFileAtPath: async (filePath: string) => {
			try {
				const db = await getDb();
				const tx = db.transaction("projects", "readonly");
				const record = await new Promise<{ projectData: unknown } | null>((res) => {
					const req = tx.objectStore("projects").get(filePath);
					req.onsuccess = () => res(req.result);
					req.onerror = () => res(null);
				});
				if (record?.projectData) {
					return { success: true, project: record.projectData };
				}
				return { success: false, error: "Project not found" };
			} catch (err) {
				return { success: false, error: (err as Error).message };
			}
		},

		loadCurrentProjectFile: async () => ({ success: false }),
		loadProjectFile: async () => ({ success: false, canceled: true }),

		openRecorder: async () => {
			return await recordBrowserScreen();
		},
		startNativeScreenRecording: async () => {
			return await recordBrowserScreen();
		},
		closeEditor: () => window.close(),
		minimizeEditor: () => {},
		maximizeEditor: () => {},
		openExternalUrl: (url: string) => window.open(url, "_blank"),
		getSystemCursorAssets: async () => ({ cursors: [] }),
		onMenuLoadProject: () => () => {},
		checkForAppUpdates: async () => ({ available: false }),

		// License Stubs
		getMachineId: async () => "REC-WEB-DEMO-0000",
		getLicenseStatus: async () => ({
			isPro: true,
			type: "machine" as const,
			machineId: "REC-WEB-DEMO-0000",
		}),
		activateLicense: async (key: string) => ({
			success: true,
			message: "Kích hoạt thành công!",
			license: {
				isPro: true,
				type: "machine" as const,
				key,
				machineId: "REC-WEB-DEMO-0000",
			},
		}),
		deactivateLicense: async () => ({ success: true }),
	};
}

/**
 * Initialize Web Extension message listener so extension recordings automatically open in editor.
 */
export function setupExtensionMessageListener() {
	if (typeof window === "undefined") return;

	// Listen for BroadcastChannel messages from extension
	try {
		const channel = new BroadcastChannel("recordly_extension_channel");
		channel.onmessage = async (event) => {
			const data = event.data;
			if (data && data.type === "RECORDLY_NEW_RECORDING") {
				const { blob, fileName, telemetry } = data;
				const registered = await registerWebMedia(blob, fileName || "recording.webm", telemetry);
				currentVideoPathState = registered.path;
				notifyRecordingSessionChanged({ videoPath: registered.path });
			}
		};
	} catch {
		// BroadcastChannel might not be supported in all contexts
	}

	// Listen for window.postMessage
	window.addEventListener("message", async (event) => {
		const data = event.data;
		if (data && data.type === "RECORDLY_NEW_RECORDING") {
			const { blob, fileName, telemetry } = data;
			const registered = await registerWebMedia(blob, fileName || "recording.webm", telemetry);
			currentVideoPathState = registered.path;
			notifyRecordingSessionChanged({ videoPath: registered.path });
		}
	});
}
