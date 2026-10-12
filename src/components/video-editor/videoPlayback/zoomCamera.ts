import {
	createSpringState,
	getPanSpringConfig,
	resetSpringState,
	type SpringConfig,
	type SpringState,
	stepSpringValue,
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
	/** Continuous leash anchor to eliminate micro-jitter when cursor is stationary */
	deadbandFocusX: number;
	deadbandFocusY: number;
}

export function createZoomCameraState(): ZoomCameraState {
	return {
		scale: createSpringState(1),
		progress: createSpringState(0),
		focusX: createSpringState(0.5),
		focusY: createSpringState(0.5),
		heldFocusX: 0.5,
		heldFocusY: 0.5,
		deadbandFocusX: 0.5,
		deadbandFocusY: 0.5,
	};
}

export function resetZoomCameraState(state: ZoomCameraState): void {
	resetSpringState(state.scale, 1);
	resetSpringState(state.progress, 0);
	resetSpringState(state.focusX, 0.5);
	resetSpringState(state.focusY, 0.5);
	state.heldFocusX = 0.5;
	state.heldFocusY = 0.5;
	state.deadbandFocusX = 0.5;
	state.deadbandFocusY = 0.5;
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

	// When completely idle (progress = 0), reset focus to target and mark uninitialized
	// so the next zoom starts cleanly from its target focus.
	if (targetProgress <= 0) {
		state.heldFocusX = target.focusX;
		state.heldFocusY = target.focusY;
		state.deadbandFocusX = target.focusX;
		state.deadbandFocusY = target.focusY;
		state.focusX.value = target.focusX;
		state.focusY.value = target.focusY;
		state.focusX.velocity = 0;
		state.focusY.velocity = 0;
		state.focusX.initialized = false;
		state.focusY.initialized = false;
		state.scale.value = 1;
		state.scale.velocity = 0;
		state.progress.value = 0;
		state.progress.velocity = 0;

		return composeZoomCameraTransform(options.geometry, 1, 0, target.focusX, target.focusY);
	}

	// Hold the last focus while zooming so the camera does not drift back
	// towards the centre as it releases.
	state.heldFocusX = target.focusX;
	state.heldFocusY = target.focusY;
	const focusTargetX = state.heldFocusX;
	const focusTargetY = state.heldFocusY;

	let currentFocusX = focusTargetX;
	let currentFocusY = focusTargetY;

	if (!options.animate) {
		// Paused or seeking: snap directly to target
		state.focusX.value = focusTargetX;
		state.focusY.value = focusTargetY;
		state.focusX.velocity = 0;
		state.focusY.velocity = 0;
		state.focusX.initialized = true;
		state.focusY.initialized = true;
		state.deadbandFocusX = focusTargetX;
		state.deadbandFocusY = focusTargetY;
		currentFocusX = focusTargetX;
		currentFocusY = focusTargetY;
	} else if (!state.focusX.initialized) {
		// First frame of a zoom-in: initialize squarely on target focus
		state.focusX.value = focusTargetX;
		state.focusY.value = focusTargetY;
		state.focusX.velocity = 0;
		state.focusY.velocity = 0;
		state.focusX.initialized = true;
		state.focusY.initialized = true;
		state.deadbandFocusX = focusTargetX;
		state.deadbandFocusY = focusTargetY;
		currentFocusX = focusTargetX;
		currentFocusY = focusTargetY;
	} else {
		// Continuous silky smooth pan tracking with zoom-adaptive second-order spring physics
		// Clamping deltaMs to [1ms, 50ms] eliminates lag spikes and micro-stutter
		const safeDeltaMs = Math.min(50, Math.max(1, options.deltaMs));

		// 0. CONTINUOUS LEASH DEADBAND (ANTI-MICRO-JITTER):
		// Khi chuột đứng yên hoặc chỉ rung vi mô do nhiễu cảm biến (1-2px), deadband giữ neo focus
		// ổn định tuyệt đối, triệt tiêu hoàn toàn hiện tượng micro-drift / camera thở phập phồng.
		// Khi chuột di chuyển thực sự vượt bán kính leash, neo trượt theo mượt mà (C0-continuous leash).
		const PAN_DEADBAND_RADIUS = 0.0025; // ~4.8px trên 1920x1080
		const deltaTargetX = focusTargetX - state.deadbandFocusX;
		const deltaTargetY = focusTargetY - state.deadbandFocusY;
		const targetDisplacement = Math.hypot(deltaTargetX, deltaTargetY);

		if (targetDisplacement > PAN_DEADBAND_RADIUS) {
			const dragFactor = (targetDisplacement - PAN_DEADBAND_RADIUS) / targetDisplacement;
			state.deadbandFocusX += deltaTargetX * dragFactor;
			state.deadbandFocusY += deltaTargetY * dragFactor;
		}

		const effectiveTargetX = state.deadbandFocusX;
		const effectiveTargetY = state.deadbandFocusY;

		// 1. ZOOM-ADAPTIVE SPEED BOOST:
		// Tăng tốc siêu êm khi phóng to, tránh làm tăng vọt độ cứng lò xo (do stiffness = omega^2)
		const zoomScaleBoost = 1 + (Math.max(1, targetScale) - 1) * 0.12;

		// 2. SOFT TETHERING CATCH-UP (QUÁN TÍNH ĐÀN HỒI MỀM MẠI):
		// Giữ nguyên cảm giác lướt bay êm dịu trên đệm không khí, tăng tốc vừa phải khi chuột ra xa
		const dist = Math.hypot(
			effectiveTargetX - state.focusX.value,
			effectiveTargetY - state.focusY.value,
		);
		const catchUpMultiplier = 1 + Math.min(0.5, Math.max(0, dist - 0.08) * 1.5);

		const effectiveSpeedMultiplier = Math.min(
			1.5,
			(options.panSpeedMultiplier ?? 1.0) * zoomScaleBoost * catchUpMultiplier,
		);

		const panConfig = getPanSpringConfig(0.5, undefined, effectiveSpeedMultiplier);

		currentFocusX = stepSpringValue(state.focusX, effectiveTargetX, safeDeltaMs, panConfig);
		currentFocusY = stepSpringValue(state.focusY, effectiveTargetY, safeDeltaMs, panConfig);
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
