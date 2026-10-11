import { describe, expect, it } from "vitest";
import { clampFocusToDepth, DEFAULT_AUTO_ZOOM_DEPTH, type ZoomRegion } from "../types";

describe("Zoom action state transition helpers", () => {
	it("adds a zoom region correctly with clamped focus", () => {
		const defaultDepth = 2;
		const rawFocus = { cx: 0.95, cy: 0.95 };
		const clamped = clampFocusToDepth(rawFocus, defaultDepth);

		const newRegion: ZoomRegion = {
			id: "zoom-1",
			startMs: 1000,
			endMs: 3000,
			depth: defaultDepth,
			focus: clamped,
			mode: "auto",
		};

		expect(newRegion.id).toBe("zoom-1");
		expect(newRegion.startMs).toBe(1000);
		expect(newRegion.endMs).toBe(3000);
		expect(newRegion.depth).toBe(2);
		expect(newRegion.focus.cx).toBe(0.95);
		expect(newRegion.focus.cy).toBe(0.95);
	});

	it("creates auto suggested zoom with DEFAULT_AUTO_ZOOM_DEPTH", () => {
		const rawFocus = { cx: 0.5, cy: 0.5 };
		const newRegion: ZoomRegion = {
			id: "zoom-2",
			startMs: 500,
			endMs: 2500,
			depth: DEFAULT_AUTO_ZOOM_DEPTH,
			focus: clampFocusToDepth(rawFocus, DEFAULT_AUTO_ZOOM_DEPTH),
			mode: "auto",
		};

		expect(newRegion.depth).toBe(DEFAULT_AUTO_ZOOM_DEPTH);
		expect(newRegion.focus.cx).toBe(0.5);
		expect(newRegion.focus.cy).toBe(0.5);
	});

	it("toggles disabled state on zoom regions", () => {
		const regions: ZoomRegion[] = [
			{ id: "z1", startMs: 0, endMs: 1000, depth: 2, focus: { cx: 0.5, cy: 0.5 } },
			{ id: "z2", startMs: 2000, endMs: 3000, depth: 3, focus: { cx: 0.5, cy: 0.5 } },
		];

		const turnOff = regions.some((r) => !r.disabled);
		expect(turnOff).toBe(true);

		const disabledRegions = regions.map(({ disabled: _d, ...r }) =>
			turnOff ? { ...r, disabled: true } : r,
		);
		expect(disabledRegions.every((r) => r.disabled === true)).toBe(true);

		const turnOn = disabledRegions.some((r) => !r.disabled);
		expect(turnOn).toBe(false);

		const enabledRegions = disabledRegions.map(({ disabled: _d, ...r }) =>
			turnOn ? { ...r, disabled: true } : r,
		);
		expect(enabledRegions.every((r) => r.disabled === undefined)).toBe(true);
	});
});
