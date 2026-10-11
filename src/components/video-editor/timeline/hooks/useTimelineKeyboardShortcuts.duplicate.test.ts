import { describe, expect, it } from "vitest";
import { matchesShortcut } from "@/lib/shortcuts";

describe("duplicate shortcut matching", () => {
	it("matches Ctrl+D for non-Mac systems", () => {
		const event = {
			key: "d",
			ctrlKey: true,
			metaKey: false,
			shiftKey: false,
			altKey: false,
		} as KeyboardEvent;
		expect(matchesShortcut(event, { key: "d", ctrl: true }, false)).toBe(true);
	});

	it("matches Cmd+D for Mac systems", () => {
		const event = {
			key: "d",
			ctrlKey: false,
			metaKey: true,
			shiftKey: false,
			altKey: false,
		} as KeyboardEvent;
		expect(matchesShortcut(event, { key: "d", ctrl: true }, true)).toBe(true);
	});
});
