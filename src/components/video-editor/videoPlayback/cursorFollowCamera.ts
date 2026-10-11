import type { CursorTelemetryPoint, ZoomFocus } from "../types";
import { interpolateCursorPosition } from "./cursorRenderer";
import { clampFocusToScale } from "./focusUtils";

/**
 * Cursor-follow camera.
 *
 * While zooming in, the camera heads straight for the region focus (the click).
 * Once fully zoomed it keeps a persistent center and only recenters after the
 * cursor leaves an inner safe zone, shifting just enough to bring it back inside.
 * While zooming out it holds its last position.
 */

/** Default snap ratio for manual zoom regions */
export const SNAP_TO_EDGES_RATIO_MANUAL = 0.25;
/** Time jump treated as a seek by the cursor-follow camera. */
const SEEK_JUMP_MS = 1000;
/**
 * Snap ratio for system/auto zoom regions.
 * 0 inset = continuous follow: keeps the cursor pinned at the center of the frame
 * with silky smooth Steadicam spring interpolation.
 */
export const SNAP_TO_EDGES_RATIO_AUTO = 0;

export interface CursorFollowCameraState {
	/** Whether the state has been initialized with a starting position */
	initialized: boolean;
	/** Time of last update in ms (video time, not wall clock) */
	lastTimeMs: number;
	/** Current camera focus while zoomed */
	focusX: number;
	/** Current camera focus while zoomed */
	focusY: number;
	/** Whether the camera was active (zoomed) on the previous frame */
	wasZoomed: boolean;
	/** Whether the zoom reached full strength (≈1) — used to detect zoom-out */
	reachedFullZoom: boolean;
	/** Frozen focus when zooming out (camera holds position) */
	frozenFocusX: number;
	frozenFocusY: number;
	/** Zoom strength on the previous call — detects a new zoom-in starting mid zoom-out. */
	lastStrength: number;
	/** Identifier of the currently active zoom region to avoid state leakage between regions. */
	activeRegionId?: string | null;
}

export interface CursorFollowConfig {
	/**
	 * snapToEdgesRatio — how much of the screen edge pins the camera.
	 * 0 for smooth continuous follow, >0 for deadzone box.
	 */
	snapToEdgesRatio: number;
	followSpeed?: number;
}

export const DEFAULT_CURSOR_FOLLOW_CONFIG: CursorFollowConfig = {
	snapToEdgesRatio: SNAP_TO_EDGES_RATIO_AUTO,
};

export function createCursorFollowCameraState(): CursorFollowCameraState {
	return {
		initialized: false,
		lastTimeMs: 0,
		focusX: 0.5,
		focusY: 0.5,
		wasZoomed: false,
		reachedFullZoom: false,
		frozenFocusX: 0.5,
		frozenFocusY: 0.5,
		lastStrength: 0,
		activeRegionId: null,
	};
}

/**
 * Call on every frame where no zoom region is active. Callers skip
 * computeCursorFollowFocus outside regions, so without this the "fully zoomed"
 * flag of the previous zoom leaks into the next one and freezes its camera on
 * the previous zoom's position.
 */
export function markCursorFollowIdle(state: CursorFollowCameraState): void {
	state.wasZoomed = false;
	state.initialized = false;
	state.reachedFullZoom = false;
	state.lastStrength = 0;
	state.activeRegionId = null;
}

export function resetCursorFollowCamera(state: CursorFollowCameraState): void {
	state.initialized = false;
	state.lastTimeMs = 0;
	state.focusX = 0.5;
	state.focusY = 0.5;
	state.wasZoomed = false;
	state.reachedFullZoom = false;
	state.frozenFocusX = 0.5;
	state.frozenFocusY = 0.5;
	state.lastStrength = 0;
	state.activeRegionId = null;
}

function clampSafeZoneRatio(ratio: number) {
	if (!Number.isFinite(ratio)) {
		return SNAP_TO_EDGES_RATIO_AUTO;
	}

	return Math.max(0, Math.min(0.49, ratio));
}

function getVisibleHalfSpan(zoomScale: number) {
	return 1 / (2 * Math.max(1, zoomScale));
}

function recenterFocusWhenCursorLeavesSafeZone(
	currentFocus: ZoomFocus,
	cursorFocus: ZoomFocus,
	zoomScale: number,
	safeZoneRatio: number,
): ZoomFocus {
	const halfSpan = getVisibleHalfSpan(zoomScale);
	const visibleSpan = halfSpan * 2;
	const safeZoneInset = visibleSpan * clampSafeZoneRatio(safeZoneRatio);

	const safeLeft = currentFocus.cx - halfSpan + safeZoneInset;
	const safeRight = currentFocus.cx + halfSpan - safeZoneInset;
	const safeTop = currentFocus.cy - halfSpan + safeZoneInset;
	const safeBottom = currentFocus.cy + halfSpan - safeZoneInset;

	let nextFocusX = currentFocus.cx;
	let nextFocusY = currentFocus.cy;

	if (cursorFocus.cx < safeLeft) {
		nextFocusX = cursorFocus.cx + halfSpan - safeZoneInset;
	} else if (cursorFocus.cx > safeRight) {
		nextFocusX = cursorFocus.cx - halfSpan + safeZoneInset;
	}

	if (cursorFocus.cy < safeTop) {
		nextFocusY = cursorFocus.cy + halfSpan - safeZoneInset;
	} else if (cursorFocus.cy > safeBottom) {
		nextFocusY = cursorFocus.cy - halfSpan + safeZoneInset;
	}

	return clampFocusToScale(
		{
			cx: nextFocusX,
			cy: nextFocusY,
		},
		zoomScale,
	);
}

/**
 * Cursor follow: target focus computation.
 *
 * Computes the desired camera focus point based on the cursor position and zoom state.
 * The zoom camera spring layer handles smooth, organic physics interpolation toward
 * the returned focus point.
 *
 * @returns The target focus point for this frame (normalized 0-1).
 */
export function computeCursorFollowFocus(
	state: CursorFollowCameraState,
	cursorSamples: CursorTelemetryPoint[],
	timeMs: number,
	zoomScale: number,
	zoomStrength: number,
	regionFocus: ZoomFocus,
	config: CursorFollowConfig = DEFAULT_CURSOR_FOLLOW_CONFIG,
	regionId?: string,
): ZoomFocus {
	if (
		regionId !== undefined &&
		state.activeRegionId !== undefined &&
		state.activeRegionId !== null &&
		state.activeRegionId !== regionId
	) {
		state.reachedFullZoom = false;
		state.initialized = false;
		state.wasZoomed = false;
		state.lastStrength = 0;
	}
	if (regionId !== undefined) {
		state.activeRegionId = regionId;
	}

	const clampedRegionFocus = clampFocusToScale(regionFocus, zoomScale);

	// If not zoomed (strength <= 0), reset state and return region focus
	if (zoomStrength <= 0) {
		state.lastStrength = 0;
		if (state.wasZoomed) {
			state.wasZoomed = false;
			state.initialized = false;
			state.reachedFullZoom = false;
		} else if (state.reachedFullZoom) {
			// Still had reachedFullZoom from previous block — clear it so next block starts fresh
			state.reachedFullZoom = false;
		}
		return clampedRegionFocus;
	}

	const cursorPos = interpolateCursorPosition(cursorSamples, timeMs);
	if (!cursorPos) {
		return state.initialized ? { cx: state.focusX, cy: state.focusY } : clampedRegionFocus;
	}

	// A seek (backwards, or a jump of more than a second) invalidates the phase
	// tracking — otherwise a stale "fully zoomed" flag would freeze the camera.
	if (
		state.initialized &&
		(timeMs + 0.5 < state.lastTimeMs || Math.abs(timeMs - state.lastTimeMs) > SEEK_JUMP_MS)
	) {
		state.initialized = false;
		state.reachedFullZoom = false;
	}

	// A zoom that starts while the previous one is still releasing (back-to-back
	// regions) never passes through "idle": strength falls, then rises again.
	// Treat the rise as a new zoom-in so it heads for its own focus instead of
	// staying frozen on the previous zoom's position.
	const previousStrength = state.lastStrength;
	state.lastStrength = zoomStrength;
	if (state.reachedFullZoom && zoomStrength < 0.99 && zoomStrength > previousStrength + 1e-4) {
		state.reachedFullZoom = false;
	}

	// Track when zoom reaches full strength
	if (zoomStrength >= 0.99) {
		state.reachedFullZoom = true;
	}

	// Zooming out: was fully zoomed but strength is now dropping — freeze camera
	if (state.reachedFullZoom && zoomStrength < 0.99) {
		state.lastTimeMs = timeMs;
		return { cx: state.frozenFocusX, cy: state.frozenFocusY };
	}

	const timeWentBackwards = state.initialized && timeMs + 0.5 < state.lastTimeMs;
	const safeZoneRatio = config.snapToEdgesRatio;
	let rawTarget: ZoomFocus;

	if (safeZoneRatio > 0) {
		const currentBaseFocus =
			!state.initialized || !state.wasZoomed || timeWentBackwards
				? clampedRegionFocus
				: { cx: state.focusX, cy: state.focusY };

		rawTarget = recenterFocusWhenCursorLeavesSafeZone(
			currentBaseFocus,
			{ cx: cursorPos.cx, cy: cursorPos.cy },
			zoomScale,
			safeZoneRatio,
		);
	} else {
		rawTarget = clampFocusToScale({ cx: cursorPos.cx, cy: cursorPos.cy }, zoomScale);
	}

	// Zoom-in phase: head straight for the region focus (the click / action point)
	if (!state.reachedFullZoom) {
		state.lastTimeMs = timeMs;
		state.initialized = true;
		state.wasZoomed = true;
		state.focusX = clampedRegionFocus.cx;
		state.focusY = clampedRegionFocus.cy;
		state.frozenFocusX = clampedRegionFocus.cx;
		state.frozenFocusY = clampedRegionFocus.cy;
		return clampedRegionFocus;
	}

	// When safeZoneRatio <= 0 (continuous follow), target the cursor directly to pin
	// the mouse at the center of the frame. The downstream zoomCamera stepSpringValue layer
	// provides buttery smooth Steadicam interpolation without double-filtering lag.
	const targetFocus = rawTarget;

	state.lastTimeMs = timeMs;
	state.initialized = true;
	state.wasZoomed = true;
	state.focusX = targetFocus.cx;
	state.focusY = targetFocus.cy;
	state.frozenFocusX = targetFocus.cx;
	state.frozenFocusY = targetFocus.cy;

	return targetFocus;
}
