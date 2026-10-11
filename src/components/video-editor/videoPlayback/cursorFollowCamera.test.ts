import { describe, expect, it } from "vitest";
import { computeCursorFollowFocus, createCursorFollowCameraState } from "./cursorFollowCamera";

describe("computeCursorFollowFocus", () => {
	it("holds the camera while the cursor stays inside the safe zone", () => {
		const state = createCursorFollowCameraState();
		const cursorSamples = [
			{ timeMs: 0, cx: 0.5, cy: 0.5, interactionType: "move" as const },
			{ timeMs: 100, cx: 0.6, cy: 0.58, interactionType: "move" as const },
		];

		const initialFocus = computeCursorFollowFocus(
			state,
			cursorSamples,
			0,
			2,
			1,
			{ cx: 0.5, cy: 0.5 },
			{ snapToEdgesRatio: 0.25 },
		);
		const heldFocus = computeCursorFollowFocus(
			state,
			cursorSamples,
			100,
			2,
			1,
			{ cx: 0.5, cy: 0.5 },
			{ snapToEdgesRatio: 0.25 },
		);

		expect(initialFocus).toEqual({ cx: 0.5, cy: 0.5 });
		expect(heldFocus).toEqual(initialFocus);
	});

	it("shifts the camera just enough to keep the cursor inside the safe zone", () => {
		const state = createCursorFollowCameraState();
		const cursorSamples = [
			{ timeMs: 0, cx: 0.5, cy: 0.5, interactionType: "move" as const },
			{ timeMs: 100, cx: 0.7, cy: 0.5, interactionType: "move" as const },
			{ timeMs: 200, cx: 0.72, cy: 0.5, interactionType: "move" as const },
		];

		computeCursorFollowFocus(
			state,
			cursorSamples,
			0,
			2,
			1,
			{ cx: 0.5, cy: 0.5 },
			{ snapToEdgesRatio: 0.25 },
		);

		const firstShift = computeCursorFollowFocus(
			state,
			cursorSamples,
			100,
			2,
			1,
			{ cx: 0.5, cy: 0.5 },
			{ snapToEdgesRatio: 0.25 },
		);
		const secondShift = computeCursorFollowFocus(
			state,
			cursorSamples,
			200,
			2,
			1,
			{ cx: 0.5, cy: 0.5 },
			{ snapToEdgesRatio: 0.25 },
		);

		// Zoom 2x → visible half-span 0.25, safe-zone inset 0.125. The camera shifts
		// just enough to bring the cursor back inside the safe zone: 0.7 - 0.25 + 0.125.
		expect(firstShift.cx).toBeCloseTo(0.575, 6);
		expect(firstShift.cy).toBeCloseTo(0.5, 6);
		// 0.72 is outside the new safe zone (right edge 0.7) → shift again to 0.595.
		expect(secondShift.cx).toBeCloseTo(0.595, 6);
		expect(secondShift.cy).toBeCloseTo(0.5, 6);
	});

	it("clamps the camera when the cursor pushes past the stage edge", () => {
		const state = createCursorFollowCameraState();
		const cursorSamples = [
			{ timeMs: 0, cx: 0.5, cy: 0.5, interactionType: "move" as const },
			{ timeMs: 100, cx: 1, cy: 1, interactionType: "move" as const },
		];

		computeCursorFollowFocus(
			state,
			cursorSamples,
			0,
			2,
			1,
			{ cx: 0.5, cy: 0.5 },
			{ snapToEdgesRatio: 0.25 },
		);

		const clampedFocus = computeCursorFollowFocus(
			state,
			cursorSamples,
			100,
			2,
			1,
			{ cx: 0.5, cy: 0.5 },
			{ snapToEdgesRatio: 0.25 },
		);

		expect(clampedFocus).toEqual({ cx: 0.75, cy: 0.75 });
	});
});
