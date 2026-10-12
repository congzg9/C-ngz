import { Assets, BlurFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import { MotionBlurFilter } from "pixi-filters/motion-blur";
import minimalCursorUrl from "@/assets/cursors/custom/minimal-cursor.svg";
import { getRenderableAssetUrl } from "@/lib/assetPath";
import { extensionHost } from "@/lib/extensions";
import { type ClickSoundStyle, playClickSound } from "../audio/clickSoundGenerator";
import {
	type CursorStyle,
	type CursorTelemetryPoint,
	DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	DEFAULT_CURSOR_STYLE,
} from "../types";
import { computeCursorSwayRotation } from "./cursorSway";
import { type CursorViewportRect, projectCursorPositionToViewport } from "./cursorViewport";
import {
	type CursorSpringTuning,
	createSpringState,
	getCursorSpringConfig,
	resetSpringState,
	stepSpringValue,
} from "./motionSmoothing";
import { cursorSetAssets, getCursorStyleSizeMultiplier } from "./uploadedCursorAssets";

type CursorAssetKey = NonNullable<CursorTelemetryPoint["cursorType"]>;
type StatefulCursorStyle = Extract<CursorStyle, "macos" | "tahoe" | "tahoe-inverted">;
type SingleCursorStyle = Extract<CursorStyle, "figma">;
type CursorPackStyle = Exclude<CursorStyle, StatefulCursorStyle | SingleCursorStyle>;
type CursorPackVariant = "default" | "pointer";

type LoadedCursorAsset = {
	texture: Texture;
	image: HTMLImageElement;
	aspectRatio: number;
	anchorX: number;
	anchorY: number;
};

type LoadedCursorPackAssets = Record<CursorPackVariant, LoadedCursorAsset>;

type CursorPackSource = {
	defaultUrl: string;
	pointerUrl: string;
	defaultAnchor: { x: number; y: number };
	pointerAnchor: { x: number; y: number };
};

export type NativeCursorAtlasEntry = {
	cursorType: CursorAssetKey;
	index: number;
	x: number;
	y: number;
	width: number;
	height: number;
	anchorX: number;
	anchorY: number;
	aspectRatio: number;
};

export type NativeCursorAtlas = {
	style: CursorStyle;
	width: number;
	height: number;
	dataUrl: string;
	entries: NativeCursorAtlasEntry[];
};

/**
 * Configuration for cursor rendering.
 */
export interface CursorRenderConfig {
	/** Base cursor height in pixels (at reference width of 1920px) */
	dotRadius: number;
	/** Cursor fill color (hex number for PixiJS) */
	dotColor: number;
	/** Cursor opacity (0–1) */
	dotAlpha: number;
	/** Unused, kept for interface compatibility */
	trailLength: number;
	/** Smoothing factor for cursor interpolation (0–1, lower = smoother/slower) */
	smoothingFactor: number;
	/** Optional multipliers applied on top of the derived cursor spring config. */
	springTuning: CursorSpringTuning;
	/** Directional cursor motion blur amount. */
	motionBlur: number;
	/** Click bounce multiplier. */
	clickBounce: number;
	/** Click bounce duration in milliseconds. */
	clickBounceDuration: number;
	/** Whether to show a ripple ring on click. */
	showClickEffect: boolean;
	/** Visual style for click effect */
	clickEffectStyle:
		| "ring"
		| "spotlight"
		| "bloom"
		| "sonar"
		| "magnetic"
		| "stardust"
		| "flare"
		| "ripple"
		| "dot"
		| "pulse"
		| "target"
		| "sparks";
	/** Size multiplier for click effect (0.3 – 3). */
	clickEffectSize: number;
	/** Whether to play a click sound. */
	clickSound: boolean;
	/** Click sound style. */
	clickSoundStyle?: ClickSoundStyle;
	/** Click sound volume (0 to 1). */
	clickSoundVolume?: number;
	/** Cursor sway multiplier. */
	sway: number;
	/** Cursor visual style. */
	style: CursorStyle;
}

export const DEFAULT_CURSOR_CONFIG: CursorRenderConfig = {
	dotRadius: 28,
	dotColor: 0xffffff,
	dotAlpha: 0.95,
	trailLength: 0,
	smoothingFactor: 0.18,
	springTuning: {
		stiffnessMultiplier: 1,
		dampingMultiplier: 1,
		massMultiplier: 1,
	},
	motionBlur: 0,
	clickBounce: 1,
	clickBounceDuration: DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	showClickEffect: true,
	clickEffectStyle: "ring",
	clickEffectSize: 1,
	clickSound: false,
	clickSoundStyle: "crisp",
	clickSoundVolume: 0.7,
	sway: 0,
	style: DEFAULT_CURSOR_STYLE,
};

const REFERENCE_WIDTH = 1920;
const MIN_CURSOR_VIEWPORT_SCALE = 0.55;
const CLICK_RING_FADE_MS = 600;
const CURSOR_MOTION_BLUR_BASE_MULTIPLIER = 0.08;
const CURSOR_TIME_DISCONTINUITY_MS = 100;
const CURSOR_SWAY_SMOOTHING_MULTIPLIER = 0.7;
const CURSOR_SWAY_SMOOTHING_OFFSET = 0.18;
const CURSOR_SVG_DROP_SHADOW_FILTER = "drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.35))";
const CURSOR_SHADOW_COLOR = 0x000000;
const CURSOR_SHADOW_ALPHA = 0.35;
const CURSOR_SHADOW_OFFSET_X = 0;
const CURSOR_SHADOW_OFFSET_Y = 2;
const CURSOR_SHADOW_BLUR = 3;
const CURSOR_SHADOW_PADDING = 12;
const NATIVE_CURSOR_ATLAS_DRAW_HEIGHT = 256;
const NATIVE_CURSOR_ATLAS_PADDING = 2;
let cursorAssetsPromise: Promise<void> | null = null;
let cursorPackAssetsPromise: Promise<void> | null = null;
let loadedCursorPackSourcesSignature = "";
let loadedCursorAssets: Partial<Record<CursorAssetKey, LoadedCursorAsset>> = {};
let loadedCursorSetAssets: Partial<
	Record<StatefulCursorStyle, Partial<Record<CursorAssetKey, LoadedCursorAsset>>>
> = {};
let loadedCursorStyleAssets: Partial<Record<SingleCursorStyle, LoadedCursorAsset>> = {};
let loadedCursorPackAssets: Partial<Record<string, LoadedCursorPackAssets>> = {};
const warnedMissingCursorPackStyles = new Set<string>();
const SUPPORTED_CURSOR_KEYS: CursorAssetKey[] = [
	"arrow",
	"text",
	"pointer",
	"crosshair",
	"open-hand",
	"closed-hand",
	"resize-ew",
	"resize-ns",
	"not-allowed",
];

const DEFAULT_CURSOR_PACK_ANCHOR = { x: 0.08, y: 0.08 } as const;
const CURSOR_PACK_POINTER_TYPES = new Set<CursorAssetKey>(["pointer", "open-hand", "closed-hand"]);
const CUSTOM_CURSOR_PACK_ANCHOR = { x: 0.0625, y: 0.056 } as const;

// Inline SVG data URIs using the Minimal cursor shape — avoids Electron file-path issues.
const NEON_ARROW_SVG = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><filter id="glow" x="-30%" y="-20%" width="160%" height="140%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path filter="url(#glow)" d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="#00fff0"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="white" stroke-width="19.8759"/></svg>')}`;
const GLOW_ARROW_SVG = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="40" y1="20" x2="355" y2="370" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#22d3ee"/><stop offset="50%" stop-color="#a855f7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><path d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="url(#g)"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="white" stroke-width="14"/></svg>')}`;
const GRADIENT_ARROW_SVG = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="40" y1="20" x2="355" y2="370" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f97316"/><stop offset="30%" stop-color="#ec4899"/><stop offset="65%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient><linearGradient id="sh" x1="40" y1="20" x2="200" y2="220" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="rgba(255,255,255,0.45)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></linearGradient><filter id="drop" x="-15%" y="-10%" width="130%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="rgba(0,0,0,0.4)"/></filter></defs><path filter="url(#drop)" d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="url(#g)"/><path d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="url(#sh)"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="rgba(255,255,255,0.35)" stroke-width="14"/></svg>')}`;
const WHITE_ARROW_SVG = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><g filter="url(#shadow)"><path d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="#ffffff"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="rgba(15,23,42,0.9)" stroke-width="19.8759"/></g><defs><filter id="shadow" x="0" y="0" width="395.86" height="432.694" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="19.8759"/><feGaussianBlur stdDeviation="19.8759"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.28 0"/><feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/><feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/></filter></defs></svg>')}`;

const BUILTIN_CURSOR_PACK_SOURCES: Record<string, CursorPackSource> = {
	dot: {
		defaultUrl: WHITE_ARROW_SVG,
		pointerUrl: WHITE_ARROW_SVG,
		defaultAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
		pointerAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
	},
	neon: {
		defaultUrl: NEON_ARROW_SVG,
		pointerUrl: NEON_ARROW_SVG,
		defaultAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
		pointerAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
	},
	glow: {
		defaultUrl: GLOW_ARROW_SVG,
		pointerUrl: GLOW_ARROW_SVG,
		defaultAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
		pointerAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
	},
	gradient: {
		defaultUrl: GRADIENT_ARROW_SVG,
		pointerUrl: GRADIENT_ARROW_SVG,
		defaultAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
		pointerAnchor: CUSTOM_CURSOR_PACK_ANCHOR,
	},
};

function getCursorPackSources(): Record<string, CursorPackSource> {
	const sources: Record<string, CursorPackSource> = { ...BUILTIN_CURSOR_PACK_SOURCES };

	for (const cursorStyle of extensionHost.getContributedCursorStyles()) {
		const hotspot = cursorStyle.cursorStyle.hotspot ?? DEFAULT_CURSOR_PACK_ANCHOR;
		sources[cursorStyle.id] = {
			defaultUrl: cursorStyle.resolvedDefaultUrl,
			pointerUrl: cursorStyle.resolvedClickUrl ?? cursorStyle.resolvedDefaultUrl,
			defaultAnchor: hotspot,
			pointerAnchor: hotspot,
		};
	}

	return sources;
}

function buildCursorPackSourcesSignature(sources: Record<string, CursorPackSource>): string {
	return Object.entries(sources)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(
			([style, source]) =>
				`${style}:${source.defaultUrl}:${source.pointerUrl}:${source.defaultAnchor.x}:${source.defaultAnchor.y}:${source.pointerAnchor.x}:${source.pointerAnchor.y}`,
		)
		.join("|");
}

function isStatefulCursorStyle(style: CursorStyle): style is StatefulCursorStyle {
	return style === "macos" || style === "tahoe" || style === "tahoe-inverted";
}

function isSingleCursorStyle(style: CursorStyle): style is SingleCursorStyle {
	return style === "figma";
}

function resolveCursorPackVariant(cursorType: CursorAssetKey): CursorPackVariant {
	return CURSOR_PACK_POINTER_TYPES.has(cursorType) ? "pointer" : "default";
}

async function createCursorStyleAsset(style: SingleCursorStyle): Promise<LoadedCursorAsset> {
	if (style === "figma") {
		const image = await loadImage(minimalCursorUrl);
		const sourceCanvas = document.createElement("canvas");
		sourceCanvas.width = image.naturalWidth;
		sourceCanvas.height = image.naturalHeight;
		const sourceCtx = sourceCanvas.getContext("2d")!;
		sourceCtx.drawImage(image, 0, 0);
		const trimmed = trimCanvasToAlpha(sourceCanvas, { x: 40, y: 22 });
		await Assets.load(trimmed.dataUrl);
		const trimmedImage = await loadImage(trimmed.dataUrl);
		const texture = Texture.from(trimmed.dataUrl);

		return {
			texture,
			image: trimmedImage,
			aspectRatio: trimmed.height > 0 ? trimmed.width / trimmed.height : 1,
			anchorX: trimmed.hotspot && trimmed.width > 0 ? trimmed.hotspot.x / trimmed.width : 0,
			anchorY: trimmed.hotspot && trimmed.height > 0 ? trimmed.hotspot.y / trimmed.height : 0,
		};
	}

	// Exhaustive: SingleCursorStyle only contains "figma" — this is unreachable
	throw new Error(`Unhandled cursor style: ${style satisfies never}`);
}

async function createCursorPackAsset(
	url: string,
	anchor: { x: number; y: number },
): Promise<LoadedCursorAsset> {
	const renderableUrl = await getRenderableAssetUrl(url);
	await Assets.load(renderableUrl);
	const image = await loadImage(renderableUrl);
	const texture = Texture.from(renderableUrl);

	return {
		texture,
		image,
		aspectRatio: image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1,
		anchorX: clamp(anchor.x, 0, 1),
		anchorY: clamp(anchor.y, 0, 1),
	};
}

function loadImage(dataUrl: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () =>
			reject(new Error(`Failed to load cursor image: ${dataUrl.slice(0, 128)}`));
		image.src = dataUrl;
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function trimCanvasToAlpha(canvas: HTMLCanvasElement, hotspot?: { x: number; y: number }) {
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return {
			dataUrl: canvas.toDataURL("image/png"),
			width: canvas.width,
			height: canvas.height,
			hotspot,
		};
	}

	const { width, height } = canvas;
	const imageData = ctx.getImageData(0, 0, width, height);
	const { data } = imageData;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (alpha === 0) {
				continue;
			}

			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	if (maxX < minX || maxY < minY) {
		return {
			dataUrl: canvas.toDataURL("image/png"),
			width,
			height,
			hotspot,
		};
	}

	const croppedWidth = maxX - minX + 1;
	const croppedHeight = maxY - minY + 1;
	const croppedCanvas = document.createElement("canvas");
	croppedCanvas.width = croppedWidth;
	croppedCanvas.height = croppedHeight;
	const croppedCtx = croppedCanvas.getContext("2d")!;
	croppedCtx.drawImage(
		canvas,
		minX,
		minY,
		croppedWidth,
		croppedHeight,
		0,
		0,
		croppedWidth,
		croppedHeight,
	);

	return {
		dataUrl: croppedCanvas.toDataURL("image/png"),
		width: croppedWidth,
		height: croppedHeight,
		hotspot: hotspot
			? {
					x: hotspot.x - minX,
					y: hotspot.y - minY,
				}
			: undefined,
	};
}

async function createInvertedCursorAsset(asset: LoadedCursorAsset): Promise<LoadedCursorAsset> {
	const canvas = document.createElement("canvas");
	canvas.width = asset.image.naturalWidth;
	canvas.height = asset.image.naturalHeight;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(asset.image, 0, 0);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const { data } = imageData;
	for (let index = 0; index < data.length; index += 4) {
		if (data[index + 3] === 0) {
			continue;
		}

		data[index] = 255 - data[index];
		data[index + 1] = 255 - data[index + 1];
		data[index + 2] = 255 - data[index + 2];
	}
	ctx.putImageData(imageData, 0, 0);

	const dataUrl = canvas.toDataURL("image/png");
	await Assets.load(dataUrl);
	const image = await loadImage(dataUrl);
	const texture = Texture.from(dataUrl);

	return {
		texture,
		image,
		aspectRatio: asset.aspectRatio,
		anchorX: asset.anchorX,
		anchorY: asset.anchorY,
	};
}

function getCursorAsset(key: CursorAssetKey): LoadedCursorAsset {
	const asset = loadedCursorAssets[key];
	if (!asset) {
		throw new Error(`Missing cursor asset for ${key}`);
	}

	return asset;
}

function getAvailableCursorKeys(): CursorAssetKey[] {
	const loadedKeys = Object.keys(loadedCursorAssets) as CursorAssetKey[];
	return loadedKeys.length > 0 ? loadedKeys : ["arrow"];
}

function getCursorStyleAsset(style: SingleCursorStyle) {
	const asset = loadedCursorStyleAssets[style];
	if (!asset) {
		throw new Error(`Missing cursor style asset for ${style}`);
	}

	return asset;
}

function getCursorPackStyleAsset(style: CursorPackStyle, key: CursorAssetKey) {
	const styleAssets = loadedCursorPackAssets[style];
	if (!styleAssets) {
		if (!warnedMissingCursorPackStyles.has(style)) {
			warnedMissingCursorPackStyles.add(style);
			console.warn(
				`[CursorRenderer] Missing cursor pack assets for ${style}; falling back to Tahoe cursors.`,
			);
		}
		return getStatefulCursorAsset("tahoe", key);
	}

	const variant = resolveCursorPackVariant(key);
	return styleAssets[variant] ?? styleAssets.default;
}

function getStatefulCursorAsset(style: StatefulCursorStyle, key: CursorAssetKey) {
	const assetMap = loadedCursorSetAssets[style] ?? loadedCursorAssets;
	const asset = assetMap[key] ?? assetMap.arrow;
	if (!asset) {
		throw new Error(`Missing ${style} cursor asset for ${key}`);
	}

	return asset;
}

async function ensureCursorPackAssetsLoaded() {
	const sources = getCursorPackSources();
	const signature = buildCursorPackSourcesSignature(sources);

	if (!cursorPackAssetsPromise || loadedCursorPackSourcesSignature !== signature) {
		loadedCursorPackSourcesSignature = signature;
		warnedMissingCursorPackStyles.clear();
		cursorPackAssetsPromise = (async () => {
			const cursorPackEntries = await Promise.all(
				Object.entries(sources).map(async ([style, source]) => {
					try {
						const [defaultAsset, pointerAsset] = await Promise.all([
							createCursorPackAsset(source.defaultUrl, source.defaultAnchor),
							createCursorPackAsset(source.pointerUrl, source.pointerAnchor),
						]);
						return [style, { default: defaultAsset, pointer: pointerAsset }] as const;
					} catch (error) {
						console.warn(
							`[CursorRenderer] Failed to load cursor pack style for: ${style}`,
							error,
						);
						return null;
					}
				}),
			);

			loadedCursorPackAssets = Object.fromEntries(
				cursorPackEntries.filter(Boolean).map((entry) => entry!),
			) as Partial<Record<string, LoadedCursorPackAssets>>;
		})();
	}

	await cursorPackAssetsPromise;
}

export async function preloadCursorAssets() {
	if (!cursorAssetsPromise) {
		cursorAssetsPromise = (async () => {
			async function loadCursorSet(
				style: keyof typeof cursorSetAssets,
			): Promise<Partial<Record<CursorAssetKey, LoadedCursorAsset>>> {
				const entries = await Promise.all(
					SUPPORTED_CURSOR_KEYS.map(async (key) => {
						const sourceAsset = cursorSetAssets[style][key];
						if (!sourceAsset?.url) {
							console.warn(`[CursorRenderer] No cursor image for: ${style}/${key}`);
							return null;
						}

						try {
							await Assets.load(sourceAsset.url);
							const image = await loadImage(sourceAsset.url);
							const texture = Texture.from(sourceAsset.url);

							return [
								key,
								{
									texture,
									image,
									aspectRatio:
										image.naturalHeight > 0
											? image.naturalWidth / image.naturalHeight
											: 1,
									anchorX: clamp(sourceAsset.fallbackAnchor.x, 0, 1),
									anchorY: clamp(sourceAsset.fallbackAnchor.y, 0, 1),
								} satisfies LoadedCursorAsset,
							] as const;
						} catch (error) {
							console.warn(
								`[CursorRenderer] Failed to load cursor image for: ${style}/${key}`,
								error,
							);
							return null;
						}
					}),
				);

				return Object.fromEntries(
					entries.filter(Boolean).map((entry) => entry!),
				) as Partial<Record<CursorAssetKey, LoadedCursorAsset>>;
			}

			const [macosAssets, tahoeAssets] = await Promise.all([
				loadCursorSet("macos"),
				loadCursorSet("tahoe"),
			]);

			const invertedEntries = await Promise.all(
				(Object.entries(tahoeAssets) as Array<[CursorAssetKey, LoadedCursorAsset]>).map(
					async ([key, asset]) => [key, await createInvertedCursorAsset(asset)] as const,
				),
			);

			loadedCursorSetAssets = {
				macos: macosAssets,
				tahoe: tahoeAssets,
				"tahoe-inverted": Object.fromEntries(invertedEntries) as Partial<
					Record<CursorAssetKey, LoadedCursorAsset>
				>,
			};
			loadedCursorAssets = tahoeAssets;

			const customStyleEntries = await Promise.all(
				(["figma"] as const).map(
					async (style) => [style, await createCursorStyleAsset(style)] as const,
				),
			);

			loadedCursorStyleAssets = Object.fromEntries(customStyleEntries) as Partial<
				Record<SingleCursorStyle, LoadedCursorAsset>
			>;

			if (!loadedCursorAssets.arrow) {
				throw new Error("Failed to initialize the fallback arrow cursor asset");
			}
		})();
	}

	await cursorAssetsPromise;
	await ensureCursorPackAssetsLoaded();
}

function getNativeCursorAtlasAsset(style: CursorStyle, key: CursorAssetKey) {
	if (isStatefulCursorStyle(style)) {
		return getStatefulCursorAsset(style, key);
	}

	if (isSingleCursorStyle(style)) {
		return getCursorStyleAsset(style);
	}

	return getCursorPackStyleAsset(style, key);
}

export async function buildNativeCursorAtlas(
	style: CursorStyle = DEFAULT_CURSOR_STYLE,
): Promise<NativeCursorAtlas | null> {
	if (typeof document === "undefined") {
		return null;
	}

	await preloadCursorAssets();

	const entries: NativeCursorAtlasEntry[] = [];
	const packedAssets = SUPPORTED_CURSOR_KEYS.map((key, index) => {
		const asset = getNativeCursorAtlasAsset(style, key);
		const height = NATIVE_CURSOR_ATLAS_DRAW_HEIGHT;
		const width = Math.max(1, Math.round(height * asset.aspectRatio));
		return { key, index, asset, width, height };
	});

	const atlasWidth = packedAssets.reduce(
		(total, item) => total + item.width + NATIVE_CURSOR_ATLAS_PADDING,
		NATIVE_CURSOR_ATLAS_PADDING,
	);
	const atlasHeight = NATIVE_CURSOR_ATLAS_DRAW_HEIGHT + NATIVE_CURSOR_ATLAS_PADDING * 2;
	const canvas = document.createElement("canvas");
	canvas.width = atlasWidth;
	canvas.height = atlasHeight;

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return null;
	}

	ctx.clearRect(0, 0, atlasWidth, atlasHeight);
	let x = NATIVE_CURSOR_ATLAS_PADDING;
	for (const { key, index, asset, width, height } of packedAssets) {
		const y = NATIVE_CURSOR_ATLAS_PADDING;
		ctx.drawImage(asset.image, x, y, width, height);
		entries.push({
			cursorType: key,
			index,
			x,
			y,
			width,
			height,
			anchorX: asset.anchorX,
			anchorY: asset.anchorY,
			aspectRatio: asset.aspectRatio,
		});
		x += width + NATIVE_CURSOR_ATLAS_PADDING;
	}

	return {
		style,
		width: atlasWidth,
		height: atlasHeight,
		dataUrl: canvas.toDataURL("image/png"),
		entries,
	};
}

/**
 * 1D Catmull-Rom Spline evaluation for smooth C1-continuous motion curves.
 */
function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
	const t2 = t * t;
	const t3 = t2 * t;
	return (
		0.5 *
		(2 * p1 +
			(-p0 + p2) * t +
			(2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
			(-p0 + 3 * p1 - 3 * p2 + p3) * t3)
	);
}

/**
 * Interpolates cursor position from telemetry samples at the specified timestamp.
 * Uses Catmull-Rom Spline interpolation for silky, C1-continuous curves without corner sharp edges.
 */
export function interpolateCursorPosition(
	samples: CursorTelemetryPoint[],
	timeMs: number,
): { cx: number; cy: number } | null {
	if (!samples || samples.length === 0) return null;

	if (timeMs <= samples[0].timeMs) {
		return { cx: samples[0].cx, cy: samples[0].cy };
	}

	if (timeMs >= samples[samples.length - 1].timeMs) {
		return {
			cx: samples[samples.length - 1].cx,
			cy: samples[samples.length - 1].cy,
		};
	}

	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi - 1) {
		const mid = (lo + hi) >> 1;
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	const a = samples[lo];
	const b = samples[hi];
	const span = b.timeMs - a.timeMs;
	if (span <= 0) return { cx: a.cx, cy: a.cy };

	const t = (timeMs - a.timeMs) / span;

	// For large pauses or time gaps (> 250ms), fallback to linear interpolation to avoid overshoot
	if (span > 250) {
		return {
			cx: a.cx + (b.cx - a.cx) * t,
			cy: a.cy + (b.cy - a.cy) * t,
		};
	}

	// Adjacent control points for Catmull-Rom spline
	const p1 = a;
	const p2 = b;

	let p0 = lo > 0 ? samples[lo - 1] : null;
	if (!p0 || a.timeMs - p0.timeMs > 250) {
		// Natural linear velocity tangent reflection at sequence start or gap
		p0 = { cx: 2 * a.cx - b.cx, cy: 2 * a.cy - b.cy } as CursorTelemetryPoint;
	}

	let p3 = hi < samples.length - 1 ? samples[hi + 1] : null;
	if (!p3 || p3.timeMs - b.timeMs > 250) {
		// Natural linear velocity tangent reflection at sequence end or gap
		p3 = { cx: 2 * b.cx - a.cx, cy: 2 * b.cy - a.cy } as CursorTelemetryPoint;
	}

	const rawCx = catmullRom1D(p0.cx, p1.cx, p2.cx, p3.cx, t);
	const rawCy = catmullRom1D(p0.cy, p1.cy, p2.cy, p3.cy, t);

	return {
		cx: Math.max(0, Math.min(1, rawCx)),
		cy: Math.max(0, Math.min(1, rawCy)),
	};
}

function findLatestSample(samples: CursorTelemetryPoint[], timeMs: number) {
	if (samples.length === 0) return null;

	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	return samples[lo]?.timeMs <= timeMs ? samples[lo] : null;
}

function findLatestInteractionSample(samples: CursorTelemetryPoint[], timeMs: number) {
	for (let index = samples.length - 1; index >= 0; index -= 1) {
		const sample = samples[index];
		if (sample.timeMs > timeMs) {
			continue;
		}

		if (
			sample.interactionType === "click" ||
			sample.interactionType === "double-click" ||
			sample.interactionType === "right-click" ||
			sample.interactionType === "middle-click"
		) {
			return sample;
		}
	}

	return null;
}

function findLatestStableCursorType(samples: CursorTelemetryPoint[], timeMs: number) {
	// Binary search to find position at timeMs, then scan backwards
	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	// Scan backwards from the position to find a sample with cursorType
	// Skip click events only (not mouseup) to avoid transient re-type during clicks
	for (let index = lo; index >= 0; index -= 1) {
		const sample = samples[index];
		if (sample.timeMs > timeMs) {
			continue;
		}

		if (!sample.cursorType) {
			continue;
		}

		if (
			sample.interactionType === "click" ||
			sample.interactionType === "double-click" ||
			sample.interactionType === "right-click" ||
			sample.interactionType === "middle-click"
		) {
			continue;
		}

		return sample.cursorType;
	}

	return findLatestSample(samples, timeMs)?.cursorType ?? "arrow";
}

function getCursorViewportScale(viewport: CursorViewportRect) {
	return Math.max(MIN_CURSOR_VIEWPORT_SCALE, viewport.width / REFERENCE_WIDTH);
}

function getCursorSwaySpringConfig(smoothingFactor: number, springTuning: CursorSpringTuning) {
	const baseConfig = getCursorSpringConfig(
		Math.min(
			2,
			Math.max(
				0.15,
				smoothingFactor * CURSOR_SWAY_SMOOTHING_MULTIPLIER + CURSOR_SWAY_SMOOTHING_OFFSET,
			),
		),
		springTuning,
	);

	return {
		...baseConfig,
		damping: baseConfig.damping * 0.9,
		mass: Math.max(0.55, baseConfig.mass * 0.8),
		restDelta: 0.0005,
		restSpeed: 0.02,
	};
}

function getCursorVisualState(
	samples: CursorTelemetryPoint[],
	timeMs: number,
	clickBounceDuration: number,
) {
	const latestClick = findLatestInteractionSample(samples, timeMs);
	const interactionType = latestClick?.interactionType;
	const ageMs = latestClick ? Math.max(0, timeMs - latestClick.timeMs) : Number.POSITIVE_INFINITY;
	const isClickEvent =
		interactionType === "click" ||
		interactionType === "double-click" ||
		interactionType === "right-click" ||
		interactionType === "middle-click";
	const clickBounceProgress =
		latestClick && isClickEvent && ageMs <= clickBounceDuration
			? 1 - ageMs / clickBounceDuration
			: 0;

	return {
		cursorType: findLatestStableCursorType(samples, timeMs),
		clickBounceProgress,
		clickProgress:
			latestClick && isClickEvent && ageMs <= CLICK_RING_FADE_MS
				? 1 - ageMs / CLICK_RING_FADE_MS
				: 0,
	};
}

/**
 * Manages a smoothed cursor state that chases the interpolated target.
 */
export class SmoothedCursorState {
	public x = 0.5;
	public y = 0.5;
	public trail: Array<{ x: number; y: number }> = [];
	private smoothingFactor: number;
	private springTuning: CursorSpringTuning;
	private trailLength: number;
	private initialized = false;
	private lastTimeMs: number | null = null;
	private xSpring = createSpringState(0.5);
	private ySpring = createSpringState(0.5);

	constructor(
		config: Pick<CursorRenderConfig, "smoothingFactor" | "trailLength" | "springTuning">,
	) {
		this.smoothingFactor = config.smoothingFactor;
		this.springTuning = config.springTuning;
		this.trailLength = config.trailLength;
	}

	update(targetX: number, targetY: number, timeMs: number): void {
		if (!this.initialized) {
			this.x = targetX;
			this.y = targetY;
			this.initialized = true;
			this.lastTimeMs = timeMs;
			this.xSpring.value = targetX;
			this.ySpring.value = targetY;
			this.xSpring.velocity = 0;
			this.ySpring.velocity = 0;
			this.xSpring.initialized = true;
			this.ySpring.initialized = true;
			this.trail = [];
			return;
		}

		if (this.smoothingFactor <= 0 || (this.lastTimeMs !== null && timeMs < this.lastTimeMs)) {
			this.snapTo(targetX, targetY, timeMs);
			return;
		}

		this.trail.unshift({ x: this.x, y: this.y });
		if (this.trail.length > this.trailLength) {
			this.trail.length = this.trailLength;
		}

		const deltaMs =
			this.lastTimeMs === null ? 1000 / 60 : Math.max(1, timeMs - this.lastTimeMs);
		this.lastTimeMs = timeMs;

		const springConfig = getCursorSpringConfig(this.smoothingFactor, this.springTuning);
		this.x = stepSpringValue(this.xSpring, targetX, deltaMs, springConfig);
		this.y = stepSpringValue(this.ySpring, targetY, deltaMs, springConfig);
	}

	setSmoothingFactor(smoothingFactor: number): void {
		this.smoothingFactor = smoothingFactor;
	}

	setSpringTuning(springTuning: CursorSpringTuning): void {
		this.springTuning = springTuning;
	}

	snapTo(targetX: number, targetY: number, timeMs: number): void {
		this.x = targetX;
		this.y = targetY;
		this.initialized = true;
		this.lastTimeMs = timeMs;
		this.xSpring.value = targetX;
		this.ySpring.value = targetY;
		this.xSpring.velocity = 0;
		this.ySpring.velocity = 0;
		this.xSpring.initialized = true;
		this.ySpring.initialized = true;
		this.trail = [];
	}

	reset(): void {
		this.initialized = false;
		this.lastTimeMs = null;
		this.trail = [];
		resetSpringState(this.xSpring, this.x);
		resetSpringState(this.ySpring, this.y);
	}
}

export class PixiCursorOverlay {
	public readonly container: Container;
	private clickRingGraphics: Graphics;
	private customCursorShadowSprite: Sprite;
	private customCursorShadowFilter: BlurFilter;
	private customCursorSprite: Sprite;
	private cursorShadowSprites: Partial<Record<CursorAssetKey, Sprite>>;
	private cursorShadowFilters: Partial<Record<CursorAssetKey, BlurFilter>>;
	private cursorSprites: Partial<Record<CursorAssetKey, Sprite>>;
	private cursorMotionBlurFilter: MotionBlurFilter;
	private state: SmoothedCursorState;
	private config: CursorRenderConfig;
	private lastRenderedPoint: { px: number; py: number } | null = null;
	private lastRenderedTimeMs: number | null = null;
	private swayRotation = 0;
	private swaySpring = createSpringState(0);
	private lastPlayedClickTime: number | null = null;

	constructor(config: Partial<CursorRenderConfig> = {}) {
		this.config = {
			...DEFAULT_CURSOR_CONFIG,
			...config,
			springTuning: {
				...DEFAULT_CURSOR_CONFIG.springTuning,
				...config.springTuning,
			},
		};
		this.state = new SmoothedCursorState(this.config);

		this.container = new Container();
		this.container.label = "cursor-overlay";

		this.clickRingGraphics = new Graphics();
		const initialCustomAsset = getCursorStyleAsset("figma");
		this.customCursorShadowSprite = new Sprite(initialCustomAsset.texture);
		this.customCursorShadowSprite.anchor.set(
			initialCustomAsset.anchorX,
			initialCustomAsset.anchorY,
		);
		this.customCursorShadowSprite.visible = false;
		this.customCursorShadowSprite.tint = CURSOR_SHADOW_COLOR;
		this.customCursorShadowSprite.alpha = CURSOR_SHADOW_ALPHA;
		this.customCursorShadowFilter = new BlurFilter();
		this.customCursorShadowFilter.blur = CURSOR_SHADOW_BLUR;
		this.customCursorShadowFilter.quality = 4;
		this.customCursorShadowFilter.padding = CURSOR_SHADOW_PADDING;
		this.customCursorShadowSprite.filters = [this.customCursorShadowFilter];

		this.customCursorSprite = new Sprite(initialCustomAsset.texture);
		this.customCursorSprite.anchor.set(initialCustomAsset.anchorX, initialCustomAsset.anchorY);
		this.customCursorSprite.visible = false;
		this.cursorShadowSprites = {};
		this.cursorShadowFilters = {};
		this.cursorSprites = {};
		for (const key of getAvailableCursorKeys()) {
			const asset = getCursorAsset(key);
			const shadowSprite = new Sprite(asset.texture);
			shadowSprite.anchor.set(asset.anchorX, asset.anchorY);
			shadowSprite.visible = false;
			shadowSprite.tint = CURSOR_SHADOW_COLOR;
			shadowSprite.alpha = CURSOR_SHADOW_ALPHA;
			const shadowFilter = new BlurFilter();
			shadowFilter.blur = CURSOR_SHADOW_BLUR;
			shadowFilter.quality = 4;
			shadowFilter.padding = CURSOR_SHADOW_PADDING;
			shadowSprite.filters = [shadowFilter];
			this.cursorShadowSprites[key] = shadowSprite;
			this.cursorShadowFilters[key] = shadowFilter;

			const sprite = new Sprite(asset.texture);
			sprite.anchor.set(asset.anchorX, asset.anchorY);
			sprite.visible = false;
			this.cursorSprites[key] = sprite;
		}

		this.cursorMotionBlurFilter = new MotionBlurFilter([0, 0], 5, 0);
		this.container.filters = null;

		this.container.addChild(
			this.clickRingGraphics,
			this.customCursorShadowSprite,
			...Object.values(this.cursorShadowSprites),
			this.customCursorSprite,
			...Object.values(this.cursorSprites),
		);
		this.setMotionBlur(this.config.motionBlur);
		this.setStyle(this.config.style);
	}

	setDotRadius(dotRadius: number) {
		this.config.dotRadius = dotRadius;
	}

	setSmoothingFactor(smoothingFactor: number) {
		this.config.smoothingFactor = smoothingFactor;
		this.state.setSmoothingFactor(smoothingFactor);
	}

	setSpringTuning(springTuning: CursorSpringTuning) {
		this.config.springTuning = {
			...DEFAULT_CURSOR_CONFIG.springTuning,
			...springTuning,
		};
		this.state.setSpringTuning(this.config.springTuning);
	}

	setMotionBlur(motionBlur: number) {
		this.config.motionBlur = Math.max(0, motionBlur);
		this.container.filters = this.config.motionBlur > 0 ? [this.cursorMotionBlurFilter] : null;
		if (this.config.motionBlur <= 0) {
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			this.cursorMotionBlurFilter.kernelSize = 5;
			this.cursorMotionBlurFilter.offset = 0;
		}
	}

	setClickBounce(clickBounce: number) {
		this.config.clickBounce = Math.max(0, clickBounce);
	}

	setClickBounceDuration(clickBounceDuration: number) {
		this.config.clickBounceDuration = clamp(clickBounceDuration, 60, 500);
	}

	setShowClickEffect(showClickEffect: boolean) {
		this.config.showClickEffect = showClickEffect;
	}

	setClickEffectStyle(style: CursorRenderConfig["clickEffectStyle"]) {
		this.config.clickEffectStyle = style;
	}

	setClickEffectSize(size: number) {
		this.config.clickEffectSize = Math.max(0.1, size);
	}

	setClickSound(clickSound: boolean) {
		this.config.clickSound = clickSound;
	}

	setClickSoundStyle(style: ClickSoundStyle) {
		this.config.clickSoundStyle = style;
	}

	setClickSoundVolume(volume: number) {
		this.config.clickSoundVolume = Math.max(0, Math.min(1.5, volume));
	}

	setSway(sway: number) {
		this.config.sway = clamp(sway, 0, 2);
	}

	setStyle(style: CursorStyle) {
		this.config.style = style;
		if (isStatefulCursorStyle(style)) {
			for (const key of getAvailableCursorKeys()) {
				const asset = getStatefulCursorAsset(style, key);
				const shadowSprite = this.cursorShadowSprites[key];
				const sprite = this.cursorSprites[key];
				shadowSprite?.anchor.set(asset.anchorX, asset.anchorY);
				if (shadowSprite) {
					shadowSprite.texture = asset.texture;
				}
				sprite?.anchor.set(asset.anchorX, asset.anchorY);
				if (sprite) {
					sprite.texture = asset.texture;
				}
			}
			return;
		}

		const asset = isSingleCursorStyle(style)
			? getCursorStyleAsset(style)
			: getCursorPackStyleAsset(style, "arrow");
		this.customCursorShadowSprite.texture = asset.texture;
		this.customCursorShadowSprite.anchor.set(asset.anchorX, asset.anchorY);
		this.customCursorSprite.texture = asset.texture;
		this.customCursorSprite.anchor.set(asset.anchorX, asset.anchorY);
	}

	getSmoothedCursorSnapshot(): {
		cx: number;
		cy: number;
		trail: Array<{ cx: number; cy: number }>;
	} | null {
		if (!this.container.visible) {
			return null;
		}

		return {
			cx: this.state.x,
			cy: this.state.y,
			trail: this.state.trail.map((point) => ({ cx: point.x, cy: point.y })),
		};
	}

	update(
		samples: CursorTelemetryPoint[],
		timeMs: number,
		viewport: CursorViewportRect,
		visible: boolean,
		freeze = false,
	): void {
		if (!visible || samples.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
			this.container.visible = false;
			this.lastRenderedPoint = null;
			this.lastRenderedTimeMs = null;
			this.swayRotation = 0;
			resetSpringState(this.swaySpring, 0);
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			return;
		}

		const target = interpolateCursorPosition(samples, timeMs);
		if (!target) {
			this.container.visible = false;
			return;
		}

		const projectedTarget = projectCursorPositionToViewport(target, viewport.sourceCrop);
		if (!projectedTarget.visible) {
			this.container.visible = false;
			this.lastRenderedPoint = null;
			this.lastRenderedTimeMs = null;
			this.swayRotation = 0;
			resetSpringState(this.swaySpring, 0);
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			return;
		}

		const sameFrameTime =
			this.lastRenderedTimeMs !== null && Math.abs(this.lastRenderedTimeMs - timeMs) < 0.0001;
		const hasTimeDiscontinuity =
			this.lastRenderedTimeMs !== null &&
			Math.abs(timeMs - this.lastRenderedTimeMs) > CURSOR_TIME_DISCONTINUITY_MS;
		const shouldFreezeCursorMotion = freeze || hasTimeDiscontinuity;

		if (shouldFreezeCursorMotion) {
			if (!sameFrameTime || !this.lastRenderedPoint) {
				this.state.snapTo(projectedTarget.cx, projectedTarget.cy, timeMs);
			}
		} else {
			this.state.update(projectedTarget.cx, projectedTarget.cy, timeMs);
		}
		this.container.visible = true;

		const px = viewport.x + this.state.x * viewport.width;
		const py = viewport.y + this.state.y * viewport.height;
		const h = this.config.dotRadius * getCursorViewportScale(viewport);
		const { cursorType, clickBounceProgress } = getCursorVisualState(
			samples,
			timeMs,
			this.config.clickBounceDuration,
		);
		const latestClick = findLatestInteractionSample(samples, timeMs);
		const isClickEvent = latestClick?.interactionType?.includes("click");
		if (
			this.config.clickSound &&
			!freeze &&
			latestClick &&
			isClickEvent &&
			timeMs >= latestClick.timeMs
		) {
			const ageMs = timeMs - latestClick.timeMs;
			if (ageMs < 100 && this.lastPlayedClickTime !== latestClick.timeMs) {
				this.lastPlayedClickTime = latestClick.timeMs;
				playClickSound(
					this.config.clickSoundStyle ?? "mechanical",
					this.config.clickSoundVolume ?? 0.7,
				);
			}
		}

		const bounceScale = Math.max(
			0.72,
			1 - Math.sin(clickBounceProgress * Math.PI) * (0.08 * this.config.clickBounce),
		);
		const scaledH = h * getCursorStyleSizeMultiplier(this.config.style);
		const swayRotation = this.updateCursorSway(px, py, timeMs, shouldFreezeCursorMotion);

		this.clickRingGraphics.clear();

		// Draw click effect if enabled
		if (this.config.showClickEffect) {
			const { clickProgress } = getCursorVisualState(
				samples,
				timeMs,
				this.config.clickBounceDuration,
			);
			if (clickProgress > 0) {
				const eased = 1 - clickProgress; // 0→start, 1→end
				const baseR = scaledH * this.config.clickEffectSize;
				const style = this.config.clickEffectStyle;

				if (style === "ring") {
					// Expanding circle outline that fades
					const r = baseR * 0.55 + baseR * 1.1 * eased;
					const alpha = clickProgress * 0.9;
					this.clickRingGraphics.circle(px, py, r);
					this.clickRingGraphics.stroke({
						color: 0xffffff,
						alpha,
						width: Math.max(1.5, baseR * 0.07),
					});
				} else if (style === "spotlight") {
					// Filled glow disc that expands and fades
					const r = baseR * 0.3 + baseR * 1.4 * eased;
					const alpha = clickProgress * 0.35;
					this.clickRingGraphics.circle(px, py, r);
					this.clickRingGraphics.fill({ color: 0xffffff, alpha });
					// thin ring on top
					this.clickRingGraphics.circle(px, py, r);
					this.clickRingGraphics.stroke({
						color: 0xffffff,
						alpha: clickProgress * 0.6,
						width: Math.max(1, baseR * 0.04),
					});
				} else if (style === "bloom") {
					// Glow Bloom (Screen Studio style)
					const rOuter = baseR * (0.35 + 1.25 * eased);
					const rMid = baseR * (0.25 + 0.8 * eased);
					const rCore = baseR * (0.15 + 0.35 * (1 - eased));
					this.clickRingGraphics.circle(px, py, rOuter);
					this.clickRingGraphics.fill({ color: 0x38bdf8, alpha: clickProgress * 0.22 });
					this.clickRingGraphics.circle(px, py, rMid);
					this.clickRingGraphics.fill({ color: 0x60a5fa, alpha: clickProgress * 0.42 });
					this.clickRingGraphics.circle(px, py, rCore);
					this.clickRingGraphics.fill({ color: 0xffffff, alpha: clickProgress * 0.85 });
					this.clickRingGraphics.circle(px, py, rMid);
					this.clickRingGraphics.stroke({
						color: 0xffffff,
						alpha: clickProgress * 0.5,
						width: 1,
					});
				} else if (style === "sonar") {
					// Sonar Radar Wave
					const r1 = baseR * (0.4 + 1.3 * eased);
					const alpha1 = clickProgress * 0.85;
					this.clickRingGraphics.circle(px, py, r1);
					this.clickRingGraphics.stroke({
						color: 0x38bdf8,
						alpha: alpha1,
						width: Math.max(1.8, baseR * 0.08 * clickProgress),
					});
					const echoProgress = Math.max(0, clickProgress - 0.2) / 0.8;
					if (echoProgress > 0) {
						const echoEased = 1 - echoProgress;
						const r2 = baseR * (0.25 + 0.9 * echoEased);
						this.clickRingGraphics.circle(px, py, r2);
						this.clickRingGraphics.stroke({
							color: 0xffffff,
							alpha: echoProgress * 0.6,
							width: 1.2,
						});
					}
					this.clickRingGraphics.circle(
						px,
						py,
						Math.max(2, baseR * 0.12 * clickProgress),
					);
					this.clickRingGraphics.fill({ color: 0xffffff, alpha: clickProgress * 0.9 });
				} else if (style === "magnetic") {
					// Magnetic Wave (dual harmonic shockwave)
					const rInner = baseR * (0.35 + 0.85 * Math.pow(eased, 0.7));
					const rOuter = baseR * (0.55 + 1.45 * eased);
					this.clickRingGraphics.circle(px, py, rInner);
					this.clickRingGraphics.stroke({
						color: 0xffffff,
						alpha: clickProgress * 0.95,
						width: Math.max(2, baseR * 0.07),
					});
					this.clickRingGraphics.circle(px, py, rOuter);
					this.clickRingGraphics.stroke({
						color: 0x60a5fa,
						alpha: clickProgress * 0.45,
						width: 1.2,
					});
					this.clickRingGraphics.circle(px, py, (rInner + rOuter) * 0.5);
					this.clickRingGraphics.fill({ color: 0x2563eb, alpha: clickProgress * 0.12 });
				} else if (style === "stardust") {
					// Star Dust (8 radial micro particles)
					const dist = baseR * (0.3 + 1.3 * Math.pow(eased, 0.65));
					const sparkR = Math.max(1.5, baseR * 0.08 * (1 - eased * 0.5));
					const alpha = clickProgress * 0.9;
					for (let i = 0; i < 8; i++) {
						const angle = (i * Math.PI) / 4;
						const ox = Math.cos(angle) * dist;
						const oy = Math.sin(angle) * dist;
						this.clickRingGraphics.circle(px + ox, py + oy, sparkR);
						this.clickRingGraphics.fill({
							color: i % 2 === 0 ? 0xffffff : 0x93c5fd,
							alpha,
						});
					}
					this.clickRingGraphics.circle(px, py, baseR * 0.25 * (1 - eased));
					this.clickRingGraphics.fill({ color: 0xffffff, alpha: alpha * 0.75 });
				} else if (style === "flare") {
					// Optic Anamorphic Lens Flare
					const alpha = clickProgress * 0.9;
					const beamLen = baseR * (1.6 + 2.4 * eased);
					const beamH = Math.max(1.5, baseR * 0.06 * clickProgress);
					this.clickRingGraphics.rect(
						px - beamLen * 0.5,
						py - beamH * 0.5,
						beamLen,
						beamH,
					);
					this.clickRingGraphics.fill({ color: 0x67e8f9, alpha: alpha * 0.85 });
					const vLen = baseR * (0.6 + 0.8 * eased);
					this.clickRingGraphics.rect(px - beamH * 0.5, py - vLen * 0.5, beamH, vLen);
					this.clickRingGraphics.fill({ color: 0xffffff, alpha: alpha * 0.7 });
					this.clickRingGraphics.circle(px, py, baseR * 0.28 * (1 - eased * 0.3));
					this.clickRingGraphics.fill({ color: 0xffffff, alpha });
				} else if (style === "ripple") {
					// 3 concentric rings at staggered phases
					for (let ring = 0; ring < 3; ring++) {
						const delay = ring * 0.18;
						const p = Math.max(0, clickProgress - delay) / (1 - delay);
						if (p <= 0) continue;
						const localEased = 1 - p;
						const r = baseR * 0.4 + baseR * (0.8 + ring * 0.5) * localEased;
						const alpha = p * (0.7 - ring * 0.18);
						this.clickRingGraphics.circle(px, py, r);
						this.clickRingGraphics.stroke({
							color: 0xffffff,
							alpha,
							width: Math.max(1, baseR * 0.05),
						});
					}
				} else if (style === "dot") {
					// Filled dot that quickly blooms then shrinks + fades
					const bloom = clickProgress > 0.7 ? (1 - clickProgress) / 0.3 : 1;
					const r = baseR * 0.65 * bloom;
					const alpha = clickProgress * 0.9;
					this.clickRingGraphics.circle(px, py, r);
					this.clickRingGraphics.fill({ color: 0xffffff, alpha });
				} else if (style === "pulse") {
					// Glowing pulse: soft translucent disc + sharp expanding outer border
					const r = baseR * 0.35 + baseR * 0.95 * Math.sqrt(eased);
					const innerAlpha = clickProgress * 0.4;
					const outerAlpha = clickProgress * 0.85;
					this.clickRingGraphics.circle(px, py, r);
					this.clickRingGraphics.fill({ color: 0x3b82f6, alpha: innerAlpha });
					this.clickRingGraphics.circle(px, py, r);
					this.clickRingGraphics.stroke({
						color: 0xffffff,
						alpha: outerAlpha,
						width: Math.max(1.5, baseR * 0.06 * clickProgress),
					});
				} else if (style === "target") {
					// Target crosshair: circle + 4 small tick marks
					const r = baseR * 0.5 + baseR * 0.7 * eased;
					const alpha = clickProgress * 0.9;
					this.clickRingGraphics.circle(px, py, r);
					this.clickRingGraphics.stroke({
						color: 0xffffff,
						alpha,
						width: Math.max(1.5, baseR * 0.06),
					});
					const tickLen = baseR * 0.25;
					const tickGap = r + 2;
					this.clickRingGraphics
						.moveTo(px, py - tickGap)
						.lineTo(px, py - tickGap - tickLen)
						.stroke({ color: 0xffffff, alpha, width: 1.5 });
					this.clickRingGraphics
						.moveTo(px, py + tickGap)
						.lineTo(px, py + tickGap + tickLen)
						.stroke({ color: 0xffffff, alpha, width: 1.5 });
					this.clickRingGraphics
						.moveTo(px - tickGap, py)
						.lineTo(px - tickGap - tickLen, py)
						.stroke({ color: 0xffffff, alpha, width: 1.5 });
					this.clickRingGraphics
						.moveTo(px + tickGap, py)
						.lineTo(px + tickGap + tickLen, py)
						.stroke({ color: 0xffffff, alpha, width: 1.5 });
				} else if (style === "sparks") {
					// 4 diagonal spark particles bursting outward
					const dist = baseR * 0.4 + baseR * 1.15 * eased;
					const sparkSize = Math.max(2, baseR * 0.11 * clickProgress);
					const alpha = clickProgress * 0.9;
					const diag = 0.7071;
					const offsets = [
						{ x: diag * dist, y: diag * dist },
						{ x: -diag * dist, y: diag * dist },
						{ x: diag * dist, y: -diag * dist },
						{ x: -diag * dist, y: -diag * dist },
					];
					for (const off of offsets) {
						this.clickRingGraphics.circle(px + off.x, py + off.y, sparkSize);
						this.clickRingGraphics.fill({ color: 0xffffff, alpha });
					}
					this.clickRingGraphics.circle(px, py, baseR * 0.3 * (1 - eased));
					this.clickRingGraphics.fill({ color: 0xffffff, alpha: alpha * 0.6 });
				}
			}
		}

		const spriteKey = (
			cursorType in this.cursorSprites ? cursorType : "arrow"
		) as CursorAssetKey;

		if (isStatefulCursorStyle(this.config.style)) {
			this.customCursorShadowSprite.visible = false;
			this.customCursorSprite.visible = false;

			const asset = getStatefulCursorAsset(this.config.style, spriteKey);
			const shadowSprite =
				this.cursorShadowSprites[spriteKey] ?? this.cursorShadowSprites.arrow!;
			const sprite = this.cursorSprites[spriteKey] ?? this.cursorSprites.arrow!;

			for (const [key, currentShadowSprite] of Object.entries(
				this.cursorShadowSprites,
			) as Array<[CursorAssetKey, Sprite]>) {
				currentShadowSprite.visible = key === spriteKey;
			}

			for (const [key, currentSprite] of Object.entries(this.cursorSprites) as Array<
				[CursorAssetKey, Sprite]
			>) {
				currentSprite.visible = key === spriteKey;
			}

			if (shadowSprite) {
				shadowSprite.height = scaledH * bounceScale;
				shadowSprite.width = scaledH * bounceScale * asset.aspectRatio;
				shadowSprite.position.set(px + CURSOR_SHADOW_OFFSET_X, py + CURSOR_SHADOW_OFFSET_Y);
				shadowSprite.rotation = swayRotation;
			}

			if (sprite) {
				sprite.alpha = this.config.dotAlpha;
				sprite.height = scaledH * bounceScale;
				sprite.width = scaledH * bounceScale * asset.aspectRatio;
				sprite.position.set(px, py);
				sprite.rotation = swayRotation;
			}
		} else {
			for (const currentShadowSprite of Object.values(this.cursorShadowSprites)) {
				currentShadowSprite.visible = false;
			}

			for (const currentSprite of Object.values(this.cursorSprites)) {
				currentSprite.visible = false;
			}

			const asset = isSingleCursorStyle(this.config.style)
				? getCursorStyleAsset(this.config.style)
				: getCursorPackStyleAsset(this.config.style, spriteKey);
			const showSeparateShadow = this.config.style !== "figma";
			this.customCursorShadowSprite.texture = asset.texture;
			this.customCursorShadowSprite.anchor.set(asset.anchorX, asset.anchorY);
			this.customCursorShadowSprite.visible = showSeparateShadow;
			if (showSeparateShadow) {
				this.customCursorShadowSprite.height = scaledH * bounceScale;
				this.customCursorShadowSprite.width = scaledH * bounceScale * asset.aspectRatio;
				this.customCursorShadowSprite.position.set(
					px + CURSOR_SHADOW_OFFSET_X,
					py + CURSOR_SHADOW_OFFSET_Y,
				);
				this.customCursorShadowSprite.rotation = swayRotation;
			}

			this.customCursorSprite.texture = asset.texture;
			this.customCursorSprite.anchor.set(asset.anchorX, asset.anchorY);
			this.customCursorSprite.visible = true;
			this.customCursorSprite.alpha = this.config.dotAlpha;
			this.customCursorSprite.height = scaledH * bounceScale;
			this.customCursorSprite.width = scaledH * bounceScale * asset.aspectRatio;
			this.customCursorSprite.position.set(px, py);
			this.customCursorSprite.rotation = swayRotation;
		}

		this.applyCursorMotionBlur(px, py, timeMs, shouldFreezeCursorMotion);
		this.lastRenderedPoint = { px, py };
		this.lastRenderedTimeMs = timeMs;
	}

	private updateCursorSway(px: number, py: number, timeMs: number, freeze: boolean) {
		const deltaMs =
			this.lastRenderedTimeMs === null || freeze
				? 1000 / 60
				: Math.max(1, timeMs - this.lastRenderedTimeMs);
		const targetRotation =
			!freeze && this.lastRenderedPoint && this.lastRenderedTimeMs !== null
				? computeCursorSwayRotation(
						px - this.lastRenderedPoint.px,
						py - this.lastRenderedPoint.py,
						timeMs - this.lastRenderedTimeMs,
						this.config.sway,
					)
				: 0;

		this.swayRotation = stepSpringValue(
			this.swaySpring,
			targetRotation,
			deltaMs,
			getCursorSwaySpringConfig(this.config.smoothingFactor, this.config.springTuning),
		);

		if (Math.abs(this.swayRotation) < 0.0001 && targetRotation === 0) {
			this.swayRotation = 0;
		}

		return this.swayRotation;
	}

	private applyCursorMotionBlur(px: number, py: number, timeMs: number, freeze: boolean) {
		if (
			freeze ||
			this.config.motionBlur <= 0 ||
			!this.lastRenderedPoint ||
			this.lastRenderedTimeMs === null
		) {
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			this.cursorMotionBlurFilter.kernelSize = 5;
			this.cursorMotionBlurFilter.offset = 0;
			return;
		}

		const deltaMs = Math.max(1, timeMs - this.lastRenderedTimeMs);
		const dx = px - this.lastRenderedPoint.px;
		const dy = py - this.lastRenderedPoint.py;
		const velocityScale =
			(1000 / deltaMs) * this.config.motionBlur * CURSOR_MOTION_BLUR_BASE_MULTIPLIER;
		const velocity = {
			x: dx * velocityScale,
			y: dy * velocityScale,
		};
		const magnitude = Math.hypot(velocity.x, velocity.y);

		this.cursorMotionBlurFilter.velocity = magnitude > 0.05 ? velocity : { x: 0, y: 0 };
		this.cursorMotionBlurFilter.kernelSize = magnitude > 3 ? 9 : magnitude > 1 ? 7 : 5;
		this.cursorMotionBlurFilter.offset = magnitude > 0.5 ? -0.25 : 0;
	}

	reset(): void {
		this.state.reset();
		this.clickRingGraphics.clear();
		for (const shadowSprite of Object.values(this.cursorShadowSprites)) {
			shadowSprite.visible = false;
			shadowSprite.scale.set(1);
		}
		this.customCursorShadowSprite.visible = false;
		this.customCursorShadowSprite.scale.set(1);
		for (const sprite of Object.values(this.cursorSprites)) {
			sprite.visible = false;
			sprite.scale.set(1);
		}
		this.customCursorSprite.visible = false;
		this.customCursorSprite.scale.set(1);
		this.container.visible = false;
		this.lastRenderedPoint = null;
		this.lastRenderedTimeMs = null;
		this.swayRotation = 0;
		resetSpringState(this.swaySpring, 0);
		this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
		this.cursorMotionBlurFilter.kernelSize = 5;
		this.cursorMotionBlurFilter.offset = 0;
	}

	destroy(): void {
		this.clickRingGraphics.destroy();
		this.customCursorShadowFilter.destroy();
		for (const shadowFilter of Object.values(this.cursorShadowFilters)) {
			shadowFilter.destroy();
		}
		this.cursorMotionBlurFilter.destroy();
		this.container.destroy({ children: true });
	}
}

export function drawCursorOnCanvas(
	ctx: CanvasRenderingContext2D,
	samples: CursorTelemetryPoint[],
	timeMs: number,
	viewport: CursorViewportRect,
	smoothedState: SmoothedCursorState,
	config: CursorRenderConfig = DEFAULT_CURSOR_CONFIG,
): void {
	if (samples.length === 0 || viewport.width <= 0 || viewport.height <= 0) return;

	const target = interpolateCursorPosition(samples, timeMs);
	if (!target) return;

	const projectedTarget = projectCursorPositionToViewport(target, viewport.sourceCrop);
	if (!projectedTarget.visible) return;

	smoothedState.update(projectedTarget.cx, projectedTarget.cy, timeMs);

	const px = viewport.x + smoothedState.x * viewport.width;
	const py = viewport.y + smoothedState.y * viewport.height;
	const h = config.dotRadius * getCursorViewportScale(viewport);
	const { cursorType, clickBounceProgress } = getCursorVisualState(
		samples,
		timeMs,
		config.clickBounceDuration,
	);
	const spriteKey = (
		cursorType && loadedCursorAssets[cursorType] ? cursorType : "arrow"
	) as CursorAssetKey;
	const asset = isStatefulCursorStyle(config.style)
		? getStatefulCursorAsset(config.style, spriteKey)
		: isSingleCursorStyle(config.style)
			? getCursorStyleAsset(config.style)
			: getCursorPackStyleAsset(config.style, spriteKey);
	const bounceScale = Math.max(
		0.72,
		1 - Math.sin(clickBounceProgress * Math.PI) * (0.08 * config.clickBounce),
	);

	ctx.save();
	if (config.style !== "figma") {
		ctx.filter = CURSOR_SVG_DROP_SHADOW_FILTER;
	}

	const drawHeight = h * bounceScale * getCursorStyleSizeMultiplier(config.style);
	const drawWidth = drawHeight * asset.aspectRatio;
	const hotspotX = asset.anchorX * drawWidth;
	const hotspotY = asset.anchorY * drawHeight;
	ctx.globalAlpha = config.dotAlpha;
	ctx.drawImage(asset.image, px - hotspotX, py - hotspotY, drawWidth, drawHeight);

	ctx.restore();
}
