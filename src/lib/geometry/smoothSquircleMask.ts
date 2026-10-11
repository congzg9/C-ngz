import { Sprite, Texture } from "pixi.js";
import { drawSquircleOnCanvas } from "./squircle";

/**
 * Anti-aliased rounded-corner (squircle) mask.
 *
 * A `Graphics` mask is a stencil mask in Pixi: every pixel is either fully in or
 * fully out, so rounded corners come out jagged no matter what `antialias` is
 * set to (and render-texture passes such as motion blur never get MSAA).
 *
 * This mask draws the squircle with the Canvas 2D API — which anti-aliases its
 * edges — and uses the result as an alpha (sprite) mask, so corners get soft,
 * smooth edges like the webcam bubble already has. The canvas is
 * supersampled so corners stay smooth while the camera zooms in, and it is only
 * redrawn when the rectangle, radius or resolution actually change.
 */

export interface SmoothMaskRect {
	x: number;
	y: number;
	width: number;
	height: number;
	radius: number;
}

/** Extra resolution so corners stay crisp when the camera zooms in (up to ~2x). */
const MASK_SUPERSAMPLE = 2;
/** Transparent border so the anti-aliased edge is never clipped by the texture. */
const MASK_PADDING_PX = 2;
/** Keep the mask canvas inside common GPU texture limits. */
const MASK_MAX_CANVAS_SIZE = 8192;

export class SmoothSquircleMask {
	readonly sprite: Sprite;
	private canvas: HTMLCanvasElement | null = null;
	private texture: Texture | null = null;
	private lastKey = "";

	constructor() {
		this.sprite = new Sprite(Texture.WHITE);
		this.sprite.label = "smooth-squircle-mask";
	}

	draw(rect: SmoothMaskRect, resolution = 1): void {
		const width = Math.max(1, rect.width);
		const height = Math.max(1, rect.height);
		const paddedWidth = width + MASK_PADDING_PX * 2;
		const paddedHeight = height + MASK_PADDING_PX * 2;
		const requestedScale = Math.max(1, resolution) * MASK_SUPERSAMPLE;
		const scale = Math.max(
			0.25,
			Math.min(
				requestedScale,
				MASK_MAX_CANVAS_SIZE / paddedWidth,
				MASK_MAX_CANVAS_SIZE / paddedHeight,
			),
		);

		const key = [rect.x, rect.y, width, height, rect.radius, scale]
			.map((value) => value.toFixed(3))
			.join("|");
		if (key === this.lastKey && this.texture) {
			return;
		}
		this.lastKey = key;

		const canvasWidth = Math.max(1, Math.ceil(paddedWidth * scale));
		const canvasHeight = Math.max(1, Math.ceil(paddedHeight * scale));
		const needsNewCanvas =
			!this.canvas ||
			this.canvas.width !== canvasWidth ||
			this.canvas.height !== canvasHeight;

		if (needsNewCanvas) {
			this.canvas = document.createElement("canvas");
			this.canvas.width = canvasWidth;
			this.canvas.height = canvasHeight;
		}

		const canvas = this.canvas as HTMLCanvasElement;
		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, canvasWidth, canvasHeight);
		context.setTransform(scale, 0, 0, scale, 0, 0);
		context.imageSmoothingEnabled = true;
		context.fillStyle = "#ffffff";
		drawSquircleOnCanvas(context, {
			x: MASK_PADDING_PX,
			y: MASK_PADDING_PX,
			width,
			height,
			radius: Math.max(0, rect.radius),
		});
		context.fill();

		if (needsNewCanvas || !this.texture) {
			const previousTexture = this.texture;
			this.texture = Texture.from(canvas);
			this.sprite.texture = this.texture;
			previousTexture?.destroy(true);
		} else {
			this.texture.source.update();
		}

		this.sprite.position.set(rect.x - MASK_PADDING_PX, rect.y - MASK_PADDING_PX);
		this.sprite.scale.set(1 / scale);
	}

	destroy(): void {
		// The sprite may already be gone when its parent stage was destroyed first.
		if (!this.sprite.destroyed) {
			this.sprite.destroy();
		}
		this.texture?.destroy(true);
		this.texture = null;
		this.canvas = null;
		this.lastKey = "";
	}
}
