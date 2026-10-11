// Friendly reminder: Recordly is licensed under AGPL-3.0, author @webadderall, repo-> https://github.com/webadderall/Recordly
// Please use this code with the right attribution.

export interface SpringState {
	value: number;
	velocity: number;
	initialized: boolean;
}

export interface SpringConfig {
	stiffness: number;
	damping: number;
	mass: number;
	restDelta?: number;
	restSpeed?: number;
}

export interface CursorSpringTuning {
	stiffnessMultiplier?: number;
	dampingMultiplier?: number;
	massMultiplier?: number;
}

const CURSOR_SMOOTHING_MIN = 0;
const CURSOR_SMOOTHING_MAX = 2;
const CURSOR_SMOOTHING_LEGACY_MAX = 0.5;
const DEFAULT_CURSOR_STIFFNESS_BOOST = 1.12;
/** Zoom camera natural frequency (rad/s) measured from FocuSee sample output. */
export const ZOOM_SPRING_REFERENCE_OMEGA = 14.25;
/** Default cameraSpringMassMultiplier applied by project settings. */
const DEFAULT_CAMERA_MASS_MULTIPLIER = 1.12;

function clampSpringMultiplier(value: number | undefined) {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return 1;
	}

	const numericValue = value;
	return Math.min(3, Math.max(0.25, numericValue));
}

function applyCursorSpringTuning(config: SpringConfig, tuning?: CursorSpringTuning): SpringConfig {
	return {
		...config,
		stiffness: config.stiffness * clampSpringMultiplier(tuning?.stiffnessMultiplier),
		damping: config.damping * clampSpringMultiplier(tuning?.dampingMultiplier),
		mass: config.mass * clampSpringMultiplier(tuning?.massMultiplier),
	};
}

export function createSpringState(initialValue = 0): SpringState {
	return {
		value: initialValue,
		velocity: 0,
		initialized: false,
	};
}

export function resetSpringState(state: SpringState, initialValue?: number) {
	if (typeof initialValue === "number") {
		state.value = initialValue;
	}

	state.velocity = 0;
	state.initialized = false;
}

export function clampDeltaMs(deltaMs: number, fallbackMs = 1000 / 60) {
	if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
		return fallbackMs;
	}

	return Math.min(80, Math.max(1, deltaMs));
}

/**
 * Damped harmonic oscillator spring solver.
 *
 * Implements Hooke's law  F = −kx − cv  (stiffness k, damping c, mass m)
 * with the closed-form analytic solution for the three damping regimes:
 *   ζ < 1  →  underdamped  (oscillates then settles)
 *   ζ = 1  →  critically damped  (fastest non-oscillating convergence)
 *   ζ > 1  →  overdamped  (exponential decay, no oscillation)
 *
 * where  ζ = c / (2√(km))  and  ω₀ = √(k/m).
 *
 * All time inputs are in seconds internally.
 */

function msToSec(ms: number) {
	return ms / 1000;
}

function resolveSpringPosition(
	t: number,
	target: number,
	initialDelta: number,
	initialVelocity: number,
	dampingRatio: number,
	undampedAngularFreq: number,
): number {
	if (dampingRatio < 1) {
		// Underdamped — oscillatory envelope
		const dampedFreq = undampedAngularFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
		const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
		return (
			target -
			envelope *
				(((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) /
					dampedFreq) *
					Math.sin(dampedFreq * t) +
					initialDelta * Math.cos(dampedFreq * t))
		);
	}

	if (dampingRatio === 1) {
		// Critically damped — no oscillation, fastest convergence
		return (
			target -
			Math.exp(-undampedAngularFreq * t) *
				(initialDelta + (initialVelocity + undampedAngularFreq * initialDelta) * t)
		);
	}

	// Overdamped — exponential decay, no oscillation
	const dampedFreq = undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
	const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
	const freqT = Math.min(dampedFreq * t, 300); // cap to avoid Infinity in sinh/cosh
	return (
		target -
		(envelope *
			((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) *
				Math.sinh(freqT) +
				dampedFreq * initialDelta * Math.cosh(freqT))) /
			dampedFreq
	);
}

export function stepSpringValue(
	state: SpringState,
	target: number,
	deltaMs: number,
	config: SpringConfig,
) {
	const safeDeltaMs = clampDeltaMs(deltaMs);

	if (!state.initialized || !Number.isFinite(state.value)) {
		state.value = target;
		state.velocity = 0;
		state.initialized = true;
		return state.value;
	}

	const restDelta = config.restDelta ?? 0.0005;
	const restSpeed = config.restSpeed ?? 0.02;

	if (Math.abs(target - state.value) <= restDelta && Math.abs(state.velocity) <= restSpeed) {
		state.value = target;
		state.velocity = 0;
		return state.value;
	}

	const { stiffness, damping, mass } = config;
	const undampedAngularFreq = Math.sqrt(stiffness / mass);
	const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
	const initialDelta = target - state.value;
	const initialVelocity = -state.velocity;
	const tSec = msToSec(safeDeltaMs);

	const current = resolveSpringPosition(
		tSec,
		target,
		initialDelta,
		initialVelocity,
		dampingRatio,
		undampedAngularFreq,
	);

	// Overshoot guard for overdamped / critically-damped springs (ζ ≥ 1).
	// With a fixed target an overdamped spring never overshoots, but when
	// the target moves every frame (zoom easing curve) carried-over velocity
	// can push the value past the new target → wobble on reversal.
	// Clamping to target keeps the original animation speed while preventing
	// the jelly-like counter-oscillation.
	if (dampingRatio >= 1) {
		const crossed =
			(state.value <= target && current > target) ||
			(state.value >= target && current < target);
		if (crossed) {
			state.value = target;
			state.velocity = 0;
			return state.value;
		}
	}

	// Analytical velocity via forward-difference on the closed-form solution.
	const epsilon = 0.0001;
	const ahead = resolveSpringPosition(
		tSec + epsilon,
		target,
		initialDelta,
		initialVelocity,
		dampingRatio,
		undampedAngularFreq,
	);
	const analyticalVelocity = (ahead - current) / epsilon; // value per second

	const isBelowVelocityThreshold = Math.abs(analyticalVelocity) <= restSpeed;
	const isBelowDisplacementThreshold = Math.abs(target - current) <= restDelta;
	const isDone = isBelowVelocityThreshold && isBelowDisplacementThreshold;

	if (isDone) {
		state.value = target;
		state.velocity = 0;
	} else {
		state.value = current;
		state.velocity = analyticalVelocity;
	}

	return state.value;
}

export function getCursorSpringConfig(
	smoothingFactor: number,
	tuning?: CursorSpringTuning,
): SpringConfig {
	const clamped = Math.min(CURSOR_SMOOTHING_MAX, Math.max(CURSOR_SMOOTHING_MIN, smoothingFactor));

	if (clamped <= 0) {
		return applyCursorSpringTuning(
			{
				stiffness: 1000,
				damping: 100,
				mass: 1,
				restDelta: 0.0001,
				restSpeed: 0.001,
			},
			tuning,
		);
	}

	if (clamped <= CURSOR_SMOOTHING_LEGACY_MAX) {
		const legacyNormalized = Math.min(
			1,
			Math.max(
				0,
				(clamped - CURSOR_SMOOTHING_MIN) /
					(CURSOR_SMOOTHING_LEGACY_MAX - CURSOR_SMOOTHING_MIN),
			),
		);

		return applyCursorSpringTuning(
			{
				stiffness: (760 - legacyNormalized * 420) * DEFAULT_CURSOR_STIFFNESS_BOOST,
				damping: 34 + legacyNormalized * 24,
				mass: 0.85 + legacyNormalized * 0.55,
				restDelta: 0.0002,
				restSpeed: 0.01,
			},
			tuning,
		);
	}

	const extendedNormalized = Math.min(
		1,
		Math.max(
			0,
			(clamped - CURSOR_SMOOTHING_LEGACY_MAX) /
				(CURSOR_SMOOTHING_MAX - CURSOR_SMOOTHING_LEGACY_MAX),
		),
	);

	return applyCursorSpringTuning(
		{
			stiffness: (340 - extendedNormalized * 180) * DEFAULT_CURSOR_STIFFNESS_BOOST,
			damping: 58 + extendedNormalized * 22,
			mass: 1.35 + extendedNormalized * 0.45,
			restDelta: 0.0002,
			restSpeed: 0.01,
		},
		tuning,
	);
}

export function getZoomSpringConfig(
	smoothnessFactor = 0.5,
	tuning?: CursorSpringTuning,
): SpringConfig {
	const clamped = Math.max(0, Math.min(1, smoothnessFactor));

	if (clamped <= 0) {
		return applyCursorSpringTuning(
			{
				stiffness: 1000,
				damping: 100,
				mass: 1,
				restDelta: 0.0001,
				restSpeed: 0.001,
			},
			tuning,
		);
	}

	// Calibrated against measured FocuSee output (critically-damped spring,
	// ω ≈ 14.25 rad/s → 10–90 % in ~235 ms, settled in ~410 ms, no overshoot).
	//
	// The slider maps to natural frequency on a log scale, roughly matching
	// FocuSee's presets:  0.25 ≈ Rapid (ω≈20) · 0.5 ≈ Fast (ω≈14, default)
	//                     0.75 ≈ Medium (ω≈10) · 1.0 ≈ Slow (ω≈7).
	// The base spring is critically damped (ζ = 1). The project's default camera
	// multipliers (damping ×1.13, mass ×1.12) lower ω by √1.12 and give ζ ≈ 1.07,
	// so the base frequency is pre-compensated to land on the measured ω.
	const targetOmega = ZOOM_SPRING_REFERENCE_OMEGA * 2 ** ((0.5 - clamped) * 2);
	const baseOmega = targetOmega * Math.sqrt(DEFAULT_CAMERA_MASS_MULTIPLIER);
	const stiffness = baseOmega * baseOmega;

	return applyCursorSpringTuning(
		{
			stiffness,
			damping: 2 * Math.sqrt(stiffness),
			mass: 1,
			restDelta: 0.0005,
			restSpeed: 0.015,
		},
		tuning,
	);
}

/**
 * Convert user pan speed (1x, 2x, 3x, 4x) to spring & tracking speed multiplier.
 */
export function getPanSpeedMultiplier(speed?: number): number {
	switch (speed) {
		case 1:
			return 0.65; // Ultra smooth, soft cinematic glide
		case 3:
			return 1.45; // Fast, responsive follow
		case 4:
			return 2.1; // Snappy, tight follow
		case 2:
		default:
			return 1.0; // Standard smooth
	}
}

/**
 * Spring configuration for camera pan (cursor-follow / focus panning).
 *
 * Tuned like a professional steadicam dolly:
 * - Natural frequency around 6.5 - 8.0 rad/s with overdamping (ζ ≈ 1.2)
 * - Eliminates rigid box stopping, jitter, and abrupt direction changes
 * - Provides silky, organic gliding with a soft, cinematic deceleration landing
 */
export function getPanSpringConfig(
	smoothnessFactor = 0.5,
	tuning?: CursorSpringTuning,
	speedMultiplier = 1,
): SpringConfig {
	const clamped = Math.max(0, Math.min(1, smoothnessFactor));

	const effectiveMultiplier = Math.max(0.3, Math.min(8.0, speedMultiplier));
	const baseOmega = 6.8 * 2 ** ((0.5 - clamped) * 1.5);
	const targetOmega = baseOmega * effectiveMultiplier;
	const stiffness = targetOmega * targetOmega;
	const damping = 2.4 * targetOmega; // ζ = 1.2 (overdamped for buttery, zero-bounce deceleration)

	return applyCursorSpringTuning(
		{
			stiffness,
			damping,
			mass: 1,
			restDelta: 0.00005,
			restSpeed: 0.0005,
		},
		tuning,
	);
}

