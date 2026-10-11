import { describe, expect, it } from "vitest";
import { getZoomRegionScale, normalizeZoomSpeed, type ZoomRegion } from "../types";
import { getZoomSpringConfig } from "./motionSmoothing";
import {
	composeZoomCameraTransform,
	createZoomCameraState,
	stepZoomCamera,
	type ZoomCameraTarget,
} from "./zoomCamera";
import { findDominantRegion, getZoomEnvelopeDurationMs } from "./zoomRegionUtils";
import { computeZoomTransform } from "./zoomTransform";

const geometry = {
	stageSize: { width: 1920, height: 1080 },
	baseMask: { x: 0, y: 0, width: 1920, height: 1080 },
};
const FRAME_MS = 1000 / 60;
const springConfig = getZoomSpringConfig(0.5, {
	stiffnessMultiplier: 1,
	dampingMultiplier: 1.13,
	massMultiplier: 1.12,
});

function region(partial: Partial<ZoomRegion> & Pick<ZoomRegion, "startMs" | "endMs">): ZoomRegion {
	return {
		id: partial.id ?? "z",
		depth: partial.depth ?? 2,
		focus: partial.focus ?? { cx: 0.5, cy: 0.5 },
		...partial,
	};
}

describe("composeZoomCameraTransform", () => {
	it("matches computeZoomTransform when scale and progress are coupled", () => {
		for (const progress of [0, 0.25, 0.5, 0.8, 1]) {
			const zoomScale = 2.2;
			const expected = computeZoomTransform({
				...geometry,
				zoomScale,
				zoomProgress: progress,
				focusX: 0.3,
				focusY: 0.7,
			});
			const actual = composeZoomCameraTransform(
				geometry,
				1 + (zoomScale - 1) * progress,
				progress,
				0.3,
				0.7,
			);
			expect(actual.scale).toBeCloseTo(expected.scale, 9);
			expect(actual.x).toBeCloseTo(expected.x, 6);
			expect(actual.y).toBeCloseTo(expected.y, 6);
		}
	});
});

describe("stepZoomCamera", () => {
	function run(targetAt: (timeMs: number) => ZoomCameraTarget, durationMs: number) {
		const state = createZoomCameraState();
		const frames: Array<{ timeMs: number; scale: number; x: number; y: number }> = [];
		for (let timeMs = 0; timeMs <= durationMs; timeMs += FRAME_MS) {
			const applied = stepZoomCamera(state, targetAt(timeMs), {
				geometry,
				deltaMs: FRAME_MS,
				springConfig,
				animate: true,
			});
			frames.push({ timeMs, ...applied });
		}
		return frames;
	}

	it("keeps the pan locked to the zoom (no sideways swoop) for a single zoom", () => {
		const frames = run(
			(t) => ({ scale: 2, progress: t >= 100 && t < 1500 ? 1 : 0, focusX: 0.2, focusY: 0.5 }),
			3000,
		);
		for (const frame of frames) {
			const progress = (frame.scale - 1) / (2 - 1);
			const locked = computeZoomTransform({
				...geometry,
				zoomScale: 2,
				zoomProgress: progress,
				focusX: 0.2,
				focusY: 0.5,
			});
			expect(Math.abs(frame.x - locked.x)).toBeLessThan(1);
		}
	});

	it("does not jump when a deep zoom is followed by a shallow one", () => {
		const regions = [
			region({ id: "a", startMs: 500, endMs: 1500, depth: 4, focus: { cx: 0.25, cy: 0.5 } }),
			region({ id: "b", startMs: 1900, endMs: 3000, depth: 1, focus: { cx: 0.75, cy: 0.5 } }),
		];
		const frames = run((t) => {
			const d = findDominantRegion(regions, t, { connectZooms: false });
			return d.region
				? {
						scale: d.blendedScale ?? getZoomRegionScale(d.region),
						progress: d.strength,
						focusX: d.region.focus.cx,
						focusY: d.region.focus.cy,
					}
				: { scale: 1, progress: 0, focusX: 0.5, focusY: 0.5 };
		}, 5000);
		let maxStepPx = 0;
		for (let i = 1; i < frames.length; i += 1) {
			maxStepPx = Math.max(maxStepPx, Math.abs(frames[i].x - frames[i - 1].x));
		}
		// Old independent path jumped ~990px in a single frame here.
		expect(maxStepPx).toBeLessThan(60);
	});

	it("snaps to the target when not animating", () => {
		const state = createZoomCameraState();
		const applied = stepZoomCamera(
			state,
			{ scale: 1.5, progress: 1, focusX: 0.5, focusY: 0.5 },
			{ geometry, deltaMs: FRAME_MS, springConfig, animate: false },
		);
		expect(applied.scale).toBeCloseTo(1.5, 9);
	});

	it("smoothly pans and decelerates when target focus moves while zoomed in", () => {
		const state = createZoomCameraState();
		// First frame initializes at (0.3, 0.5) fully zoomed
		stepZoomCamera(
			state,
			{ scale: 2, progress: 1, focusX: 0.3, focusY: 0.5 },
			{ geometry, deltaMs: FRAME_MS, springConfig, animate: true },
		);

		// Target shifts to (0.7, 0.5) (e.g. cursor pushed camera)
		const frames: number[] = [];
		for (let i = 0; i < 60; i += 1) {
			stepZoomCamera(
				state,
				{ scale: 2, progress: 1, focusX: 0.7, focusY: 0.5 },
				{ geometry, deltaMs: FRAME_MS, springConfig, animate: true },
			);
			frames.push(state.focusX.value);
		}

		// Focus starts gliding smoothly without jumping
		expect(frames[0]).toBeGreaterThan(0.3);
		expect(frames[0]).toBeLessThan(0.4);
		// Focus monotonically progresses towards target
		for (let i = 1; i < frames.length; i += 1) {
			expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
		}
		// Decelerates and arrives near target smoothly
		expect(frames[frames.length - 1]).toBeGreaterThan(0.68);
	});
});

describe("slow-in / slow-out zoom", () => {
	function simulate(regions: ZoomRegion[], connectZooms: boolean, durationMs: number) {
		const state = createZoomCameraState();
		const frames: Array<{ t: number; scale: number; x: number }> = [];
		for (let t = 0; t <= durationMs; t += FRAME_MS) {
			const d = findDominantRegion(regions, t, { connectZooms });
			const target = d.region
				? {
						scale: d.blendedScale ?? getZoomRegionScale(d.region),
						progress: d.strength,
						focusX: d.region.focus.cx,
						focusY: d.region.focus.cy,
					}
				: { scale: 1, progress: 0, focusX: 0.5, focusY: 0.5 };
			const applied = stepZoomCamera(state, target, {
				geometry,
				deltaMs: FRAME_MS,
				springConfig,
				animate: true,
			});
			frames.push({ t, scale: applied.scale, x: applied.x });
		}
		return frames;
	}

	for (const connectZooms of [false, true]) {
		it(`never scales back out while zooming in (connectZooms=${connectZooms})`, () => {
			// Short smart-zoom style region (1 s) — the case that used to bounce.
			const zoom = region({ startMs: 1000, endMs: 2000, depth: 3, scale: 1.5 });
			const frames = simulate([zoom], connectZooms, 3500);
			for (let i = 1; i < frames.length; i += 1) {
				if (frames[i].t > 1500) break;
				expect(frames[i].scale).toBeGreaterThanOrEqual(frames[i - 1].scale - 1e-9);
			}
		});
	}

	it("eases in and lands softly (slow in, slow out)", () => {
		const zoom = region({ startMs: 1000, endMs: 4000, depth: 3, scale: 1.6 });
		const frames = simulate([zoom], false, 3000);
		const speed = frames.map((f, i) => (i === 0 ? 0 : f.scale - frames[i - 1].scale));
		const zoomIn = speed.filter((_, i) => frames[i].t > 1000 && frames[i].t < 2200);
		const peak = Math.max(...zoomIn);
		// First 80 ms and the landing (last 250 ms of the move) are much slower than the peak.
		const firstFrames = zoomIn.slice(0, 5);
		const landing = speed.filter((_, i) => frames[i].t > 1650 && frames[i].t < 1900);
		expect(Math.max(...firstFrames)).toBeLessThan(peak * 0.5);
		expect(Math.max(...landing)).toBeLessThan(peak * 0.35);
		// ...and the zoom is done a little after the envelope (≈800 ms + ~50 ms lag).
		const settled = frames.find((f) => f.t > 1000 && f.scale >= 1.6 - 0.006);
		expect(settled?.t).toBeGreaterThan(1650);
		expect(settled?.t).toBeLessThan(2000);
	});
});

describe("getZoomRegionScale", () => {
	it("prefers an explicit scale over the depth preset", () => {
		expect(getZoomRegionScale({ depth: 3 })).toBe(1.8);
		expect(getZoomRegionScale({ depth: 3, scale: 1.5 })).toBe(1.5);
		expect(getZoomRegionScale({ depth: 3, scale: Number.NaN })).toBe(1.8);
	});
});

describe("zoom speed (1x–4x)", () => {
	it("divides the zoom duration by the selected speed", () => {
		expect(getZoomEnvelopeDurationMs(0.5, 1)).toBeCloseTo(800, 6);
		expect(getZoomEnvelopeDurationMs(0.5, 2)).toBeCloseTo(400, 6);
		expect(getZoomEnvelopeDurationMs(0.5, 3)).toBeCloseTo(800 / 3, 6);
		expect(getZoomEnvelopeDurationMs(0.5, 4)).toBeCloseTo(200, 6);
		expect(getZoomEnvelopeDurationMs(0.5, Number.NaN)).toBeCloseTo(800, 6);
	});

	it("normalizes stored values to 1x–4x", () => {
		expect(normalizeZoomSpeed(undefined)).toBe(1);
		expect(normalizeZoomSpeed(3)).toBe(3);
		expect(normalizeZoomSpeed(2.4)).toBe(2);
		expect(normalizeZoomSpeed(9)).toBe(1);
		expect(normalizeZoomSpeed("4")).toBe(1);
	});

	for (const speed of [1, 2, 3, 4]) {
		it(`keeps slow-in / slow-out and no bounce at ${speed}x`, () => {
			const durationMs = getZoomEnvelopeDurationMs(0.5, speed);
			const zoom = region({ startMs: 500, endMs: 2500, depth: 3, scale: 1.6 });
			const state = createZoomCameraState();
			const frames: Array<{ t: number; scale: number }> = [];
			for (let t = 0; t <= 2000; t += 1000 / 120) {
				const d = findDominantRegion([zoom], t, {
					connectZooms: false,
					zoomInDurationMs: durationMs,
					zoomOutDurationMs: durationMs,
				});
				const applied = stepZoomCamera(
					state,
					d.region
						? { scale: 1.6, progress: d.strength, focusX: 0.5, focusY: 0.5 }
						: { scale: 1, progress: 0, focusX: 0.5, focusY: 0.5 },
					{
						geometry,
						deltaMs: 1000 / 120,
						springConfig,
						animate: true,
						zoomSpeed: speed,
					},
				);
				frames.push({ t, scale: applied.scale });
			}
			const moving = frames.filter((f) => f.t >= 500 && f.t <= 500 + durationMs * 1.4);
			const speeds = moving.map((f, i) => (i === 0 ? 0 : f.scale - moving[i - 1].scale));
			const peak = Math.max(...speeds);
			expect(Math.min(...speeds)).toBeGreaterThanOrEqual(-1e-9);
			expect(
				Math.max(...speeds.slice(0, Math.max(2, Math.round(speeds.length * 0.08)))),
			).toBeLessThan(peak * 0.6);
			const settled = frames.find((f) => f.t > 500 && f.scale >= 1.6 - 0.006);
			expect(settled?.t).toBeLessThan(500 + durationMs * 1.35 + 20);
		});
	}
});
