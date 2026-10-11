import type { ZoomFocus, ZoomRegion } from "../types";
import { getZoomRegionScale } from "../types";
import { clampFocusToScale } from "./focusUtils";
import { clamp01, cubicBezier } from "./mathUtils";

const CHAINED_ZOOM_PAN_GAP_MS = 1350;
const CONNECTED_ZOOM_PAN_DURATION_MS = 1000;
const ZOOM_ANIMATION_LEAD_MS = 200;

type DominantRegionOptions = {
	connectZooms?: boolean;
	zoomInDurationMs?: number;
	zoomOutDurationMs?: number;
};

type ConnectedRegionPair = {
	currentRegion: ZoomRegion;
	nextRegion: ZoomRegion;
	transitionStart: number;
	transitionEnd: number;
};

type ConnectedPanTransition = {
	progress: number;
	startFocus: ZoomFocus;
	endFocus: ZoomFocus;
	startScale: number;
	endScale: number;
};

function lerp(start: number, end: number, amount: number) {
	return start + (end - start) * amount;
}

function easeConnectedPan(value: number) {
	// Same slow-in/slow-out curve as zoom in/out, so pans between regions
	// also ease off and land softly.
	return easeZoomCamera(value);
}

/**
 * Zoom timing envelope shared by every mode (animation principle "slow in, slow out").
 *
 *   - zoom-in starts at the region start and eases in gently,
 *   - it reaches top speed ~30 % of the way, then decelerates over a long, soft
 *     landing so the camera "arrives" slowly instead of stopping dead,
 *   - zoom-out starts when the region ends and uses the same curve back to 1x,
 *   - if a region ends before its zoom-in finished, the zoom-out starts from
 *     wherever the zoom-in got to, so the value is continuous (never jumps).
 *
 * The strength is monotonic inside each phase, so the camera can never zoom in
 * and then shrink back before the region ends.
 */
export const ZOOM_ENVELOPE_BASE_DURATION_MS = 800;

export function easeZoomCamera(value: number) {
	// Fast surge in the middle with a long, elegant deceleration landing (smooth landing without abrupt stop)
	return cubicBezier(0.36, 0.03, 0.05, 1, value);
}

/**
 * Envelope duration for one zoom move.
 *   zoomSmoothness (0..1, default 0.5 → 800 ms): 0.25 → ~670 ms · 1.0 → ~1130 ms
 *   zoomSpeed (1x–4x, default 1x): divides the duration → 2x = 400 ms, 4x = 200 ms.
 * The slow-in/slow-out shape is the same at every speed.
 */
export function getZoomEnvelopeDurationMs(zoomSmoothness = 0.5, zoomSpeed = 1) {
	const clamped = Math.min(
		1,
		Math.max(0, Number.isFinite(zoomSmoothness) ? zoomSmoothness : 0.5),
	);
	const speed = Number.isFinite(zoomSpeed) ? Math.min(4, Math.max(1, zoomSpeed)) : 1;
	return (ZOOM_ENVELOPE_BASE_DURATION_MS * 2 ** (clamped - 0.5)) / speed;
}

export function computeRegionStrength(
	region: ZoomRegion,
	timeMs: number,
	options: Pick<DominantRegionOptions, "zoomInDurationMs" | "zoomOutDurationMs"> = {},
) {
	const zoomInDurationMs = Math.max(
		1,
		options.zoomInDurationMs ?? ZOOM_ENVELOPE_BASE_DURATION_MS,
	);
	const zoomOutDurationMs = Math.max(
		1,
		options.zoomOutDurationMs ?? ZOOM_ENVELOPE_BASE_DURATION_MS,
	);

	if (timeMs <= region.startMs || timeMs >= region.endMs) {
		return 0;
	}

	const duration = region.endMs - region.startMs;
	if (duration <= 0) {
		return 0;
	}

	// For standard/long regions:
	// - Zoom in at the start: [startMs, startMs + zoomInDurationMs]
	// - Hold in the middle: [startMs + zoomInDurationMs, endMs - zoomOutDurationMs]
	// - Zoom out at the end: [endMs - zoomOutDurationMs, endMs]
	if (duration >= zoomInDurationMs + zoomOutDurationMs) {
		if (timeMs < region.startMs + zoomInDurationMs) {
			return easeZoomCamera((timeMs - region.startMs) / zoomInDurationMs);
		}
		if (timeMs <= region.endMs - zoomOutDurationMs) {
			return 1;
		}
		const outProgress = (timeMs - (region.endMs - zoomOutDurationMs)) / zoomOutDurationMs;
		return 1 - easeZoomCamera(outProgress);
	}

	// For short regions (e.g. short 1.5x segment):
	// Symmetrically zoom in during the first half and zoom out during the second half
	// ensuring every zoom level always performs its complete zoom-in and zoom-out lifecycle
	// without skipping steps.
	const halfDuration = duration / 2;
	if (timeMs < region.startMs + halfDuration) {
		const inProgress = (timeMs - region.startMs) / halfDuration;
		return easeZoomCamera(inProgress);
	}
	const outProgress = (timeMs - (region.startMs + halfDuration)) / halfDuration;
	return 1 - easeZoomCamera(outProgress);
}

function getLinearFocus(start: ZoomFocus, end: ZoomFocus, amount: number): ZoomFocus {
	return {
		cx: lerp(start.cx, end.cx, amount),
		cy: lerp(start.cy, end.cy, amount),
	};
}

function getResolvedFocus(region: ZoomRegion, zoomScale: number): ZoomFocus {
	return clampFocusToScale(region.focus, zoomScale);
}

function getConnectedRegionPairs(regions: ZoomRegion[]) {
	const sortedRegions = [...regions].sort((a, b) => a.startMs - b.startMs);
	const pairs: ConnectedRegionPair[] = [];

	for (let index = 0; index < sortedRegions.length - 1; index += 1) {
		const currentRegion = sortedRegions[index];
		const nextRegion = sortedRegions[index + 1];
		const gapMs = nextRegion.startMs - currentRegion.endMs;

		if (gapMs > CHAINED_ZOOM_PAN_GAP_MS) {
			continue;
		}

		pairs.push({
			currentRegion,
			nextRegion,
			transitionStart: currentRegion.endMs + ZOOM_ANIMATION_LEAD_MS,
			transitionEnd:
				currentRegion.endMs + ZOOM_ANIMATION_LEAD_MS + CONNECTED_ZOOM_PAN_DURATION_MS,
		});
	}

	return pairs;
}

function getActiveRegion(
	regions: ZoomRegion[],
	timeMs: number,
	connectedPairs: ConnectedRegionPair[],
	options: DominantRegionOptions,
) {
	const zoomOutDurationMs = Math.max(
		1,
		options.zoomOutDurationMs ?? ZOOM_ENVELOPE_BASE_DURATION_MS,
	);
	const activeRegions = regions
		.map((region) => {
			const outgoingPair = connectedPairs.find((pair) => pair.currentRegion.id === region.id);
			if (outgoingPair && timeMs >= outgoingPair.transitionStart) {
				// The connected pan takes over from here.
				return { region, strength: 0 };
			}

			const incomingPair = connectedPairs.find((pair) => pair.nextRegion.id === region.id);
			if (incomingPair) {
				if (timeMs < incomingPair.transitionStart) {
					return { region, strength: 0 };
				}
				// Entered fully zoomed through the connected pan: hold, then release
				// with the shared slow-in/slow-out curve after the region ends.
				if (timeMs <= region.endMs) {
					return { region, strength: 1 };
				}
				const releaseProgress = (timeMs - region.endMs) / zoomOutDurationMs;
				if (!outgoingPair && releaseProgress < 1) {
					return { region, strength: 1 - easeZoomCamera(releaseProgress) };
				}
				if (!outgoingPair) {
					return { region, strength: 0 };
				}
			}

			if (outgoingPair) {
				// Hold zoom until the connected pan begins.
				return {
					region,
					strength: 1,
				};
			}

			return { region, strength: computeRegionStrength(region, timeMs, options) };
		})
		.filter((entry) => entry.strength > 0)
		.sort((left, right) => {
			if (right.strength !== left.strength) {
				return right.strength - left.strength;
			}

			return right.region.startMs - left.region.startMs;
		});

	if (activeRegions.length === 0) {
		return null;
	}

	const activeRegion = activeRegions[0].region;
	const activeScale = getZoomRegionScale(activeRegion);

	return {
		region: {
			...activeRegion,
			focus: getResolvedFocus(activeRegion, activeScale),
		},
		strength: activeRegions[0].strength,
		blendedScale: null,
	};
}

/**
 * Independent mode: every region runs the shared slow-in/slow-out envelope.
 * When one region is still releasing while the next one starts, the two are
 * blended (never switched) so scale and focus stay continuous:
 *   zoom depth = max(strength_i · (scale_i − 1))
 *   focus      = strength-weighted average of the active regions' focus
 */
function getIndependentActiveRegion(
	regions: ZoomRegion[],
	timeMs: number,
	options: DominantRegionOptions,
) {
	let best: { region: ZoomRegion; strength: number } | null = null;
	let maxZoomDepth = 0;
	let weightSum = 0;
	let weightedFocusX = 0;
	let weightedFocusY = 0;

	for (const region of regions) {
		const strength = computeRegionStrength(region, timeMs, options);
		if (strength <= 0) {
			continue;
		}

		const scale = getZoomRegionScale(region);
		const focus = getResolvedFocus(region, scale);
		maxZoomDepth = Math.max(maxZoomDepth, strength * (scale - 1));
		weightSum += strength;
		weightedFocusX += focus.cx * strength;
		weightedFocusY += focus.cy * strength;

		if (
			!best ||
			strength > best.strength ||
			(strength === best.strength && region.startMs > best.region.startMs)
		) {
			best = { region, strength };
		}
	}

	if (!best || weightSum <= 0) {
		return null;
	}

	return {
		region: {
			...best.region,
			focus: { cx: weightedFocusX / weightSum, cy: weightedFocusY / weightSum },
		},
		strength: best.strength,
		// 1 + (blendedScale − 1)·strength equals the blended zoom depth above.
		blendedScale: 1 + maxZoomDepth / best.strength,
	};
}

function getConnectedRegionHold(timeMs: number, connectedPairs: ConnectedRegionPair[]) {
	for (const pair of connectedPairs) {
		if (timeMs >= pair.transitionEnd && timeMs < pair.nextRegion.startMs) {
			const nextScale = getZoomRegionScale(pair.nextRegion);
			return {
				region: {
					...pair.nextRegion,
					focus: getResolvedFocus(pair.nextRegion, nextScale),
				},
				strength: 1,
				blendedScale: null,
			};
		}
	}

	return null;
}

function getConnectedRegionTransition(connectedPairs: ConnectedRegionPair[], timeMs: number) {
	for (const pair of connectedPairs) {
		const { currentRegion, nextRegion, transitionStart, transitionEnd } = pair;

		if (timeMs < transitionStart || timeMs > transitionEnd) {
			continue;
		}

		const transitionProgress = easeConnectedPan(
			clamp01((timeMs - transitionStart) / Math.max(1, transitionEnd - transitionStart)),
		);
		const currentScale = getZoomRegionScale(currentRegion);
		const nextScale = getZoomRegionScale(nextRegion);
		const transitionScale = lerp(currentScale, nextScale, transitionProgress);
		const currentFocus = getResolvedFocus(currentRegion, currentScale);
		const nextFocus = getResolvedFocus(nextRegion, nextScale);
		const transitionFocus = getLinearFocus(currentFocus, nextFocus, transitionProgress);

		return {
			region: {
				...nextRegion,
				focus: transitionFocus,
			},
			strength: 1,
			blendedScale: transitionScale,
			transition: {
				progress: transitionProgress,
				startFocus: currentFocus,
				endFocus: nextFocus,
				startScale: currentScale,
				endScale: nextScale,
			},
		};
	}

	return null;
}

export function findDominantRegion(
	regions: ZoomRegion[],
	timeMs: number,
	options: DominantRegionOptions = {},
): {
	region: ZoomRegion | null;
	strength: number;
	blendedScale: number | null;
	transition: ConnectedPanTransition | null;
} {
	if (!options.connectZooms) {
		// Independent mode: shared slow-in/slow-out envelope per region.
		const activeRegion = getIndependentActiveRegion(regions, timeMs, options);
		return activeRegion
			? { ...activeRegion, transition: null }
			: { region: null, strength: 0, blendedScale: null, transition: null };
	}

	// Connected mode (connectZooms=true)
	const connectedPairs = getConnectedRegionPairs(regions);

	const connectedTransition = getConnectedRegionTransition(connectedPairs, timeMs);
	if (connectedTransition) {
		return connectedTransition;
	}

	const connectedHold = getConnectedRegionHold(timeMs, connectedPairs);
	if (connectedHold) {
		return { ...connectedHold, transition: null };
	}

	const activeRegion = getActiveRegion(regions, timeMs, connectedPairs, options);
	return activeRegion
		? { ...activeRegion, transition: null }
		: { region: null, strength: 0, blendedScale: null, transition: null };
}
