import {
	createSpringState,
	resetSpringState,
	type SpringConfig,
	type SpringState,
} from "./motionSmoothing";
import type { AppliedTransform, ZoomTransformGeometry } from "./zoomTransform";

/**
 * Shared zoom camera used by the editor preview and every export path.
 *
 * Instead of springing the final pixel translation (x/y) independently from the
 * scale — which lets the pan run ahead of / lag behind the zoom and makes the
 * frame slide sideways — we spring the camera *parameters*:
 *
 *   scale     applied zoom scale (1 = no zoom)
 *   progress  how "locked" the camera is onto its focus point (0..1)
 *   focusX/Y  normalized focus point inside the video mask
 *
 * The translation is then composed from those values every frame. Scale and
 * progress share the same spring and start from the same state, so for a
 * single zoom they stay perfectly coupled (identical to computeZoomTransform),
 * and when the target changes mid-flight (e.g. a 2.2x zoom followed by 1.25x)
 * every value stays continuous — no one-frame jumps.
 */

export interface ZoomCameraTarget {
	/** Full zoom scale of the active region (1 when idle). */
	scale: number;
	/** Zoom strength 0..1 (already eased by the region timing curve). */
	progress: number;
	focusX: number;
	focusY: number;
}

export interface ZoomCameraState {
	scale: SpringState;
	progress: SpringState;
	focusX: SpringState;
	focusY: SpringState;
	/** Last focus target received while zoomed; held while zooming out. */
	heldFocusX: number;
	heldFocusY: number;
}

export function createZoomCameraState(): ZoomCameraState {
	return {
		scale: createSpringState(1),
		progress: createSpringState(0),
		focusX: createSpringState(0.5),
		focusY: createSpringState(0.5),
		heldFocusX: 0.5,
		heldFocusY: 0.5,
	};
}

export function resetZoomCameraState(state: ZoomCameraState): void {
	resetSpringState(state.scale, 1);
	resetSpringState(state.progress, 0);
	resetSpringState(state.focusX, 0.5);
	resetSpringState(state.focusY, 0.5);
	state.heldFocusX = 0.5;
	state.heldFocusY = 0.5;
}

/**
 * Compose the stage transform from camera parameters.
 *
 * x = progress·(C − F) − F·(scale − 1)
 *
 * With scale = 1 + (S − 1)·progress this equals computeZoomTransform exactly:
 * the focus point glides linearly from its original position to the stage
 * centre while the frame scales around it.
 */
export function composeZoomCameraTransform(
	geometry: Pick<ZoomTransformGeometry, "stageSize" | "baseMask">,
	scale: number,
	progress: number,
	focusX: number,
	focusY: number,
): AppliedTransform {
	const { stageSize, baseMask } = geometry;
	if (
		stageSize.width <= 0 ||
		stageSize.height <= 0 ||
		baseMask.width <= 0 ||
		baseMask.height <= 0
	) {
		return { scale: 1, x: 0, y: 0 };
	}

	const safeScale = Math.max(1, scale);
	const safeProgress = Math.min(1, Math.max(0, progress));
	const focusStagePxX = baseMask.x + focusX * baseMask.width;
	const focusStagePxY = baseMask.y + focusY * baseMask.height;
	const stageCenterX = stageSize.width / 2;
	const stageCenterY = stageSize.height / 2;

	return {
		scale: safeScale,
		x: safeProgress * (stageCenterX - focusStagePxX) - focusStagePxX * (safeScale - 1),
		y: safeProgress * (stageCenterY - focusStagePxY) - focusStagePxY * (safeScale - 1),
	};
}

export interface StepZoomCameraOptions {
	geometry: Pick<ZoomTransformGeometry, "stageSize" | "baseMask">;
	deltaMs: number;
	springConfig: SpringConfig;
	panSpringConfig?: SpringConfig;
	panSpeedMultiplier?: number;
	/** false → snap to the target (paused, seeking, classic mode). */
	animate: boolean;
	/**
	 * Zoom speed multiplier (1x–4x). The envelope is that much shorter, so the
	 * follow spring is sped up by the same factor to keep the eased shape; focus
	 * pans speed up more gently (√speed) so cursor-follow stays calm.
	 */
	zoomSpeed?: number;
}

export function stepZoomCamera(
	state: ZoomCameraState,
	target: ZoomCameraTarget,
	options: StepZoomCameraOptions,
): AppliedTransform {
	const targetProgress = Math.min(1, Math.max(0, target.progress));
	const targetScale = 1 + (Math.max(1, target.scale) - 1) * targetProgress;

	// Hold the last focus while zooming out so the camera does not drift back
	// towards the centre as it releases.
	if (targetProgress > 0) {
		state.heldFocusX = target.focusX;
		state.heldFocusY = target.focusY;
	}
	const focusTargetX = state.heldFocusX;
	const focusTargetY = state.heldFocusY;

	let currentFocusX = focusTargetX;
	let currentFocusY = focusTargetY;

	// Pan tracking:
	// Pure smooth exponential interpolation without spring damping oscillations or lag.
	// When zooming in or out (targetProgress < 0.99), focus stays locked to target
	// so the initial zoom lands squarely on the region's focus point without sideways swoop.
	const isZoomedIn = targetProgress >= 0.99 && state.progress.value >= 0.99;
	const isPanActive =
		isZoomedIn &&
		(Math.abs(state.focusX.value - focusTargetX) > 0.00005 ||
			Math.abs(state.focusY.value - focusTargetY) > 0.00005);

	if (options.animate && options.deltaMs > 0 && isPanActive && state.focusX.initialized) {
		const dt = Math.min(0.1, options.deltaMs / 1000);
		const panRate = 8.5 * (options.panSpeedMultiplier ?? 1.0);
		const alpha = 1 - Math.exp(-panRate * dt);
		state.focusX.value += (focusTargetX - state.focusX.value) * alpha;
		state.focusY.value += (focusTargetY - state.focusY.value) * alpha;
		state.focusX.velocity = 0;
		state.focusY.velocity = 0;
		currentFocusX = state.focusX.value;
		currentFocusY = state.focusY.value;
	} else if (!isZoomedIn) {
		state.focusX.value = focusTargetX;
		state.focusX.velocity = 0;
		state.focusX.initialized = true;
		state.focusY.value = focusTargetY;
		state.focusY.velocity = 0;
		state.focusY.initialized = true;
	} else {
		state.focusX.value = focusTargetX;
		state.focusX.velocity = 0;
		state.focusY.value = focusTargetY;
		state.focusY.velocity = 0;
	}

	state.scale.value = targetScale;
	state.scale.velocity = 0;
	state.progress.value = targetProgress;
	state.progress.velocity = 0;

	return composeZoomCameraTransform(
		options.geometry,
		targetScale,
		targetProgress,
		currentFocusX,
		currentFocusY,
	);
}
