import { describe, expect, it } from "vitest";
import { normalizeProjectEditor } from "./projectPersistence";

describe("legacy caption data (captions feature removed)", () => {
	it("keeps caption fields from older projects verbatim so they round-trip", () => {
		const autoCaptions = [{ id: "c1", startMs: 0, endMs: 900, text: "Xin chào", words: [] }];
		const autoCaptionSettings = { enabled: true, language: "vi", fontSize: 30 };

		const normalized = normalizeProjectEditor({
			autoCaptions,
			autoCaptionSettings,
		} as Parameters<typeof normalizeProjectEditor>[0]);

		expect(normalized.autoCaptions).toEqual(autoCaptions);
		expect(normalized.autoCaptionSettings).toEqual(autoCaptionSettings);
		expect(JSON.parse(JSON.stringify(normalized)).autoCaptions).toEqual(autoCaptions);
	});

	it("does not add caption fields to projects that never had them", () => {
		const normalized = normalizeProjectEditor({});
		expect("autoCaptions" in normalized).toBe(false);
		expect("autoCaptionSettings" in normalized).toBe(false);
	});
});
