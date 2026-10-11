import { describe, expect, it } from "vitest";
import { type ClipRegion, clipsToTrims, extendAutoFullTrackClip } from "../types";

describe("useTimelineClips state logic", () => {
	it("derives trims from clips correctly", () => {
		const totalMs = 10000;
		const clips: ClipRegion[] = [
			{ id: "c1", startMs: 2000, endMs: 5000 },
			{ id: "c2", startMs: 7000, endMs: 9000 },
		];

		const trims = clipsToTrims(clips, totalMs);
		// Before first clip: 0 -> 2000
		// Gap between clips: 5000 -> 7000
		// After last clip: 9000 -> 10000
		expect(trims).toEqual([
			{ id: "trim-gap-1", startMs: 0, endMs: 2000 },
			{ id: "trim-gap-2", startMs: 5000, endMs: 7000 },
			{ id: "trim-gap-3", startMs: 9000, endMs: 10000 },
		]);
	});

	it("extends auto full-track clip on duration update", () => {
		const clips: ClipRegion[] = [{ id: "clip-0", startMs: 0, endMs: 5000, speed: 1 }];
		const extended = extendAutoFullTrackClip(clips, "clip-0", 5000, 10000);

		expect(extended).not.toBeNull();
		expect(extended?.[0].endMs).toBe(10000);
	});
});
