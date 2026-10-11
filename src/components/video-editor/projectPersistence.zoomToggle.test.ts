import { describe, expect, it } from "vitest";
import { normalizeProjectEditor } from "./projectPersistence";
import { buildTimelineItems } from "./timeline/model/timelineModel";
import type { ZoomRegion } from "./types";

const zoom = (id: string, disabled?: boolean): ZoomRegion => ({
	id,
	startMs: 1000,
	endMs: 2000,
	depth: 2,
	focus: { cx: 0.5, cy: 0.5 },
	mode: "auto",
	...(disabled ? { disabled: true } : {}),
});

describe("zoom track toggle", () => {
	it("keeps the disabled flag through save/load and omits it when on", () => {
		const normalized = normalizeProjectEditor({
			zoomRegions: [zoom("a", true), zoom("b")],
		} as Parameters<typeof normalizeProjectEditor>[0]);
		expect(normalized.zoomRegions[0].disabled).toBe(true);
		expect("disabled" in normalized.zoomRegions[1]).toBe(false);
		const reloaded = normalizeProjectEditor(JSON.parse(JSON.stringify(normalized)));
		expect(reloaded.zoomRegions.map((region) => region.disabled === true)).toEqual([
			true,
			false,
		]);
	});

	it("shows switched-off zooms as muted on the timeline", () => {
		const items = buildTimelineItems({
			zoomRegions: [zoom("a", true), zoom("b")],
			clipRegions: [],
			annotationRegions: [],
			audioRegions: [],
		});
		expect(items.filter((item) => item.variant === "zoom").map((item) => item.muted)).toEqual([
			true,
			false,
		]);
	});
});
