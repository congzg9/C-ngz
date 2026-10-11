import type { CursorTelemetryPoint, ZoomFocus } from "../types";
import { interpolateCursorPosition } from "./cursorRenderer";
import { clampFocusToScale } from "./focusUtils";

export interface SmartCameraConfig {
	targetZoomScale: number;
	dwellTimeThresholdMs: number;
	velocityThreshold: number;
	zoomOutDelayMs: number;
}

export const DEFAULT_SMART_CAMERA_CONFIG: SmartCameraConfig = {
	targetZoomScale: 1.5,
	dwellTimeThresholdMs: 400,
	velocityThreshold: 0.0008, // Screen percentage per ms
	zoomOutDelayMs: 600,
};

export function computeSmartCameraTarget(
	samples: CursorTelemetryPoint[],
	timeMs: number,
	config: SmartCameraConfig = DEFAULT_SMART_CAMERA_CONFIG,
): { targetScale: number; targetFocus: ZoomFocus } {
	// Look at a window around the current time to determine dwell or movement
	const windowStart = timeMs - config.dwellTimeThresholdMs;
	const windowEnd = timeMs + 100; // slight lookahead

	const windowSamples = samples.filter((s) => s.timeMs >= windowStart && s.timeMs <= windowEnd);

	if (windowSamples.length < 2) {
		const pos = interpolateCursorPosition(samples, timeMs);
		return {
			targetScale: 1.0,
			targetFocus: pos ? { cx: pos.cx, cy: pos.cy } : { cx: 0.5, cy: 0.5 },
		};
	}

	// Calculate bounding box and distance of cursor movement within the window
	let minX = 1,
		maxX = 0,
		minY = 1,
		maxY = 0;
	let sumX = 0,
		sumY = 0;

	for (const s of windowSamples) {
		if (s.cx < minX) minX = s.cx;
		if (s.cx > maxX) maxX = s.cx;
		if (s.cy < minY) minY = s.cy;
		if (s.cy > maxY) maxY = s.cy;
		sumX += s.cx;
		sumY += s.cy;
	}

	const dx = maxX - minX;
	const dy = maxY - minY;
	const distance = Math.hypot(dx, dy);

	const windowDuration = windowSamples[windowSamples.length - 1].timeMs - windowSamples[0].timeMs;

	// Average velocity in this window (percentage of screen per ms)
	const velocity = windowDuration > 0 ? distance / windowDuration : 0;

	const pos = interpolateCursorPosition(samples, timeMs);

	if (
		velocity < config.velocityThreshold &&
		windowDuration >= Math.min(200, config.dwellTimeThresholdMs / 2)
	) {
		// DWELL: Cursor is relatively still
		const focusX = sumX / windowSamples.length;
		const focusY = sumY / windowSamples.length;
		return {
			targetScale: config.targetZoomScale,
			targetFocus: clampFocusToScale({ cx: focusX, cy: focusY }, config.targetZoomScale),
		};
	} else {
		// MOVING: Cursor is moving fast
		return {
			targetScale: 1.0,
			targetFocus: pos
				? clampFocusToScale({ cx: pos.cx, cy: pos.cy }, 1.0)
				: { cx: 0.5, cy: 0.5 },
		};
	}
}
