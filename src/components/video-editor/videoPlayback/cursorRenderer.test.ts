import { describe, expect, it } from "vitest";
import { interpolateCursorPosition } from "./cursorRenderer";
import type { CursorTelemetryPoint } from "../types";

describe("interpolateCursorPosition", () => {
	it("returns exact point when timestamp matches or is outside boundaries", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 100, cx: 0.2, cy: 0.3, interactionType: "move" },
			{ timeMs: 200, cx: 0.6, cy: 0.7, interactionType: "move" },
		];

		expect(interpolateCursorPosition(samples, 50)).toEqual({ cx: 0.2, cy: 0.3 });
		expect(interpolateCursorPosition(samples, 100)).toEqual({ cx: 0.2, cy: 0.3 });
		expect(interpolateCursorPosition(samples, 200)).toEqual({ cx: 0.6, cy: 0.7 });
		expect(interpolateCursorPosition(samples, 300)).toEqual({ cx: 0.6, cy: 0.7 });
	});

	it("smoothly curves across samples with Catmull-Rom spline", () => {
		// A 90-degree corner: from (0.2, 0.2) to (0.5, 0.2) then turning down to (0.5, 0.8)
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.2, cy: 0.2, interactionType: "move" },
			{ timeMs: 100, cx: 0.5, cy: 0.2, interactionType: "move" },
			{ timeMs: 200, cx: 0.5, cy: 0.8, interactionType: "move" },
			{ timeMs: 300, cx: 0.8, cy: 0.8, interactionType: "move" },
		];

		// At midpoint of the turn segment [100ms, 200ms] (time = 150ms):
		// A pure linear interpolation would have cx = 0.5.
		// Catmull-Rom spline takes the incoming horizontal momentum into account,
		// slightly rounding the corner curve before settling.
		const midTurn = interpolateCursorPosition(samples, 150);
		expect(midTurn).not.toBeNull();
		expect(midTurn!.cy).toBeCloseTo(0.5, 2);
		expect(midTurn!.cx).toBeCloseTo(0.5, 6);
	});

	it("falls back to linear interpolation when time gap between samples is large", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.2, cy: 0.2, interactionType: "move" },
			{ timeMs: 1000, cx: 0.8, cy: 0.8, interactionType: "move" },
		];

		// 1000ms > 250ms gap -> pure linear
		const mid = interpolateCursorPosition(samples, 500);
		expect(mid).toEqual({ cx: 0.5, cy: 0.5 });
	});
});
