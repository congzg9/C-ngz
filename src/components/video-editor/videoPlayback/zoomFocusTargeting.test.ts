import { describe, expect, it } from "vitest";
import {
	buildInteractionZoomSuggestions,
	resolveZoomFocusForSpan,
} from "../timeline/zoomSuggestionUtils";
import type { CursorTelemetryPoint } from "../types";
import {
	computeCursorFollowFocus,
	createCursorFollowCameraState,
	markCursorFollowIdle,
} from "./cursorFollowCamera";

function move(timeMs: number, cx: number, cy: number): CursorTelemetryPoint {
	return { timeMs, cx, cy, interactionType: "move" };
}
function click(timeMs: number, cx: number, cy: number): CursorTelemetryPoint {
	return { timeMs, cx, cy, interactionType: "click" };
}

describe("resolveZoomFocusForSpan (manually added zooms)", () => {
	it("aims at the first click inside the zoom", () => {
		const telemetry = [
			move(0, 0.5, 0.8),
			move(3600, 0.09, 0.13),
			click(4040, 0.065, 0.138),
			click(4400, 0.9, 0.9),
		];
		expect(resolveZoomFocusForSpan(telemetry, 3730, 4720)).toEqual({ cx: 0.065, cy: 0.138 });
	});

	it("falls back to the cursor position shortly after the zoom starts", () => {
		const telemetry = [move(1000, 0.2, 0.2), move(2000, 0.4, 0.6)];
		const focus = resolveZoomFocusForSpan(telemetry, 1000, 2000);
		expect(focus?.cx).toBeCloseTo(0.26, 5);
		expect(focus?.cy).toBeCloseTo(0.32, 5);
	});

	it("returns null without telemetry (caller keeps the centre)", () => {
		expect(resolveZoomFocusForSpan([], 0, 1000)).toBeNull();
	});
});

describe("click clustering for suggested zooms", () => {
	it("splits clicks that are close in time but far apart on screen", () => {
		const telemetry = [
			move(0, 0.5, 0.5),
			click(4040, 0.065, 0.138),
			click(5980, 0.378, 0.444),
			move(9000, 0.4, 0.4),
		];
		const { suggestions } = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: 10000,
			defaultDurationMs: 1000,
		});
		expect(suggestions).toHaveLength(2);
		expect(suggestions[0].focus).toEqual({ cx: 0.065, cy: 0.138 });
		expect(suggestions[1].focus).toEqual({ cx: 0.378, cy: 0.444 });
	});

	it("keeps nearby clicks in one zoom that looks at the first click", () => {
		const telemetry = [
			move(0, 0.5, 0.5),
			click(2000, 0.4, 0.5),
			click(3000, 0.5, 0.55),
			move(6000, 0.5, 0.5),
		];
		const { suggestions } = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: 7000,
			defaultDurationMs: 1000,
		});
		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].focus).toEqual({ cx: 0.4, cy: 0.5 });
		expect(suggestions[0].start).toBe(1500);
		expect(suggestions[0].end).toBe(3500);
	});
});

describe("cursor-follow camera phases", () => {
	const telemetry = Array.from({ length: 200 }, (_, i) => move(i * 50, 0.2, 0.2));

	it("heads straight for the region focus while zooming in", () => {
		const state = createCursorFollowCameraState();
		const focus = computeCursorFollowFocus(state, telemetry, 1000, 1.5, 0.4, {
			cx: 0.6,
			cy: 0.6,
		});
		expect(focus).toEqual({ cx: 0.6, cy: 0.6 });
	});

	it("does not stay frozen on the previous zoom when leaving a region", () => {
		const state = createCursorFollowCameraState();
		computeCursorFollowFocus(state, telemetry, 1000, 1.5, 1, { cx: 0.4, cy: 0.4 });
		computeCursorFollowFocus(state, telemetry, 1100, 1.5, 0.5, { cx: 0.4, cy: 0.4 });
		markCursorFollowIdle(state); // no region active
		const next = computeCursorFollowFocus(state, telemetry, 3000, 1.5, 0.1, {
			cx: 0.66,
			cy: 0.5,
		});
		expect(next).toEqual({ cx: 0.66, cy: 0.5 });
	});

	it("starts a new zoom-in when back-to-back zooms never go idle", () => {
		const state = createCursorFollowCameraState();
		computeCursorFollowFocus(state, telemetry, 1000, 1.5, 1, { cx: 0.4, cy: 0.4 });
		computeCursorFollowFocus(state, telemetry, 1100, 1.5, 0.6, { cx: 0.4, cy: 0.4 }); // releasing
		computeCursorFollowFocus(state, telemetry, 1200, 1.5, 0.4, { cx: 0.4, cy: 0.4 });
		const rising = computeCursorFollowFocus(state, telemetry, 1300, 1.5, 0.5, {
			cx: 0.62,
			cy: 0.5,
		});
		expect(rising).toEqual({ cx: 0.62, cy: 0.5 });
	});
});
