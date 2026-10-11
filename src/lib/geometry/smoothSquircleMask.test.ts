import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", () => {
	class Sprite {
		texture: unknown;
		label = "";
		destroyed = false;
		position = {
			x: 0,
			y: 0,
			set(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
		};
		scale = {
			x: 1,
			y: 1,
			set(x: number, y?: number) {
				this.x = x;
				this.y = y ?? x;
			},
		};
		constructor(texture: unknown) {
			this.texture = texture;
		}
		destroy() {
			this.destroyed = true;
		}
	}
	const Texture = {
		WHITE: { id: "white" },
		from: vi.fn((canvas: unknown) => ({
			canvas,
			source: { update: vi.fn() },
			destroy: vi.fn(),
		})),
	};
	return { Sprite, Texture };
});

import { SmoothSquircleMask } from "./smoothSquircleMask";

type FakeContext = { fill: ReturnType<typeof vi.fn> } & Record<string, unknown>;
const contexts: FakeContext[] = [];

beforeEach(() => {
	contexts.length = 0;
	vi.stubGlobal("document", {
		createElement: () => {
			const context: FakeContext = {
				setTransform: vi.fn(),
				clearRect: vi.fn(),
				beginPath: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				closePath: vi.fn(),
				fill: vi.fn(),
				fillStyle: "",
				imageSmoothingEnabled: false,
			};
			contexts.push(context);
			return { width: 0, height: 0, getContext: () => context };
		},
	});
});
afterEach(() => vi.unstubAllGlobals());

describe("SmoothSquircleMask", () => {
	it("draws a supersampled anti-aliased mask aligned to the video rect", () => {
		const mask = new SmoothSquircleMask();
		mask.draw({ x: 100, y: 50, width: 800, height: 450, radius: 24 }, 1);
		const texture = mask.sprite.texture as { canvas: { width: number; height: number } };
		// 2x supersampling + 2px padding each side
		expect(texture.canvas.width).toBe((800 + 4) * 2);
		expect(texture.canvas.height).toBe((450 + 4) * 2);
		expect(mask.sprite.position.x).toBe(98);
		expect(mask.sprite.position.y).toBe(48);
		expect(mask.sprite.scale.x).toBeCloseTo(0.5, 9);
		expect(contexts[0].fill).toHaveBeenCalledTimes(1);
	});

	it("does not redraw when nothing changed", () => {
		const mask = new SmoothSquircleMask();
		const rect = { x: 0, y: 0, width: 640, height: 360, radius: 16 };
		mask.draw(rect, 1);
		mask.draw({ ...rect }, 1);
		expect(contexts[0].fill).toHaveBeenCalledTimes(1);
	});

	it("reuses the canvas for a radius change and uploads the new pixels", () => {
		const mask = new SmoothSquircleMask();
		mask.draw({ x: 0, y: 0, width: 640, height: 360, radius: 16 }, 1);
		const texture = mask.sprite.texture as { source: { update: ReturnType<typeof vi.fn> } };
		mask.draw({ x: 0, y: 0, width: 640, height: 360, radius: 40 }, 1);
		expect(contexts).toHaveLength(1);
		expect(texture.source.update).toHaveBeenCalledTimes(1);
	});

	it("keeps huge masks inside GPU texture limits", () => {
		const mask = new SmoothSquircleMask();
		mask.draw({ x: 0, y: 0, width: 7680, height: 4320, radius: 40 }, 2);
		const texture = mask.sprite.texture as { canvas: { width: number; height: number } };
		expect(texture.canvas.width).toBeLessThanOrEqual(8192);
		expect(texture.canvas.height).toBeLessThanOrEqual(8192);
	});
});
