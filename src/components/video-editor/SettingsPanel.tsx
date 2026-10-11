import {
	CursorClick,
	Desktop,
	Moon,
	MusicNotes,
	Palette,
	Plus,
	PresentationChart,
	Record,
	Scissors,
	Sun,
	TextT,
	Trash as Trash2,
	UploadSimple as Upload,
	VideoCamera,
	SpeakerHigh as Volume2,
	Waveform,
	X,
} from "@phosphor-icons/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import minimalCursorUrl from "@/assets/cursors/custom/minimal-cursor.svg";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	getAssetPath,
	getRenderableAssetUrl,
	getRenderableVideoUrl,
	getWallpaperThumbnailUrl,
} from "@/lib/assetPath";
import type { ExtensionSettingField } from "@/lib/extensions";
import { extensionHost, type FrameInstance } from "@/lib/extensions";
import { cn } from "@/lib/utils";
import type { BuiltInWallpaper } from "@/lib/wallpapers";
import {
	BUILT_IN_WALLPAPERS,
	getAvailableWallpapers,
	isVideoWallpaperSource,
} from "@/lib/wallpapers";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import {
	CLICK_SOUND_STYLES,
	type ClickSoundStyle,
	playClickSound,
} from "./audio/clickSoundGenerator";

// Inline SVG data URIs using the Minimal cursor shape for gaming cursor previews
const WHITE_ARROW_PREVIEW = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><g filter="url(#shadow)"><path d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="#ffffff"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="rgba(15,23,42,0.9)" stroke-width="19.8759"/></g><defs><filter id="shadow" x="0" y="0" width="395.86" height="432.694" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="19.8759"/><feGaussianBlur stdDeviation="19.8759"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.28 0"/><feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/><feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/></filter></defs></svg>')}`;
const NEON_ARROW_PREVIEW = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><filter id="glow" x="-30%" y="-20%" width="160%" height="140%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path filter="url(#glow)" d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="#00fff0"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="white" stroke-width="19.8759"/></svg>')}`;
const GLOW_ARROW_PREVIEW = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="40" y1="20" x2="355" y2="370" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#22d3ee"/><stop offset="50%" stop-color="#a855f7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><path d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="url(#g)"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="white" stroke-width="14"/></svg>')}`;
const GRADIENT_ARROW_PREVIEW = `data:image/svg+xml,${encodeURIComponent('<svg width="396" height="433" viewBox="0 0 396 433" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="40" y1="20" x2="355" y2="370" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f97316"/><stop offset="30%" stop-color="#ec4899"/><stop offset="65%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient><linearGradient id="sh" x1="40" y1="20" x2="200" y2="220" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="rgba(255,255,255,0.45)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></linearGradient><filter id="drop" x="-15%" y="-10%" width="130%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="rgba(0,0,0,0.4)"/></filter></defs><path filter="url(#drop)" d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="url(#g)"/><path d="M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z" fill="url(#sh)"/><path d="M346.169 199.749L202.277 244.012C197.821 245.383 193.988 248.277 191.449 252.188L119.434 363.121L49.7012 29.8407L346.169 199.749Z" stroke="rgba(255,255,255,0.35)" stroke-width="14"/></svg>')}`;

import { useI18n, useScopedT } from "../../contexts/I18nContext";
import type { AppLocale } from "../../i18n/config";
import { SUPPORTED_LOCALES } from "../../i18n/config";
import { AnnotationSettingsPanel } from "./AnnotationSettingsPanel";
import {
	CURSOR_MOTION_PRESETS,
	type CursorMotionPresetId,
	getMatchingCursorMotionPresetId,
} from "./cursorMotionPresets";
import { loadEditorPreferences, saveEditorPreferences } from "./editorPreferences";
import { SliderControl } from "./SliderControl";
import { KeyboardShortcutsDialog } from "./TutorialHelp";
import type {
	AnnotationRegion,
	AnnotationType,
	AudioRegion,
	CropRegion,
	CursorStyle,
	EditorEffectSection,
	FigureData,
	Padding,
	WebcamOverlaySettings,
	WebcamPositionPreset,
	ZoomDepth,
	ZoomMode,
	ZoomMotionBlurTuning,
	ZoomSpeed,
	ZoomTransitionEasing,
} from "./types";
import {
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_PADDING,
	DEFAULT_WEBCAM_CORNER_RADIUS,
	DEFAULT_WEBCAM_MARGIN,
	DEFAULT_WEBCAM_POSITION_PRESET,
	DEFAULT_WEBCAM_POSITION_X,
	DEFAULT_WEBCAM_POSITION_Y,
	DEFAULT_WEBCAM_REACT_TO_ZOOM,
	DEFAULT_WEBCAM_SHADOW,
	DEFAULT_WEBCAM_SIZE,
	DEFAULT_ZOOM_IN_DURATION_MS,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	DEFAULT_ZOOM_OUT_DURATION_MS,
	DEFAULT_ZOOM_SPEED,
	normalizeZoomSpeed,
	ZOOM_SPEED_OPTIONS,
} from "./types";
import { fromCursorSwaySliderValue, toCursorSwaySliderValue } from "./videoPlayback/cursorSway";
import { isZeroPadding } from "./videoPlayback/layoutUtils";
import {
	cursorSetAssets,
	getCursorStyleSizeMultiplier,
} from "./videoPlayback/uploadedCursorAssets";
import { WebcamCropControl } from "./WebcamCropControl";
import {
	getWebcamPositionForPreset,
	normalizeWebcamCropRegion,
	resolveWebcamCorner,
} from "./webcamOverlay";

const tahoeCursorUrl = cursorSetAssets.tahoe.arrow.url;
const BUILTIN_CURSOR_PREVIEW_SIZE = 28;
const BUILTIN_CURSOR_PREVIEW_FRAME_SIZE = 48;

function getStepPrecision(step: number): number {
	if (!Number.isFinite(step) || step <= 0) return 0;
	const [mantissa = "0", exponentPart = "0"] = step.toExponential().split("e");
	const exponent = Number.parseInt(exponentPart, 10);
	const mantissaDecimals = (mantissa.split(".")[1] ?? "").replace(/0+$/, "").length;
	const precision = exponent < 0 ? Math.max(0, -exponent + mantissaDecimals) : mantissaDecimals;
	return Math.min(12, precision);
}

type BackgroundTab = "image" | "video";

function getBackgroundTabForWallpaper(value: string): BackgroundTab {
	if (isVideoWallpaperSource(value)) {
		return "video";
	}

	return "image";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
			{children}
		</p>
	);
}

function WallpaperVideoPreview({ src }: { src: string }) {
	const [resolvedSrc, setResolvedSrc] = useState(src);

	useEffect(() => {
		let cancelled = false;
		setResolvedSrc(src);

		void (async () => {
			try {
				const nextSrc = await getRenderableVideoUrl(src);
				if (!cancelled) {
					setResolvedSrc(nextSrc);
				}
			} catch {
				if (!cancelled) {
					setResolvedSrc(src);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [src]);

	return (
		<video
			src={resolvedSrc}
			muted
			playsInline
			preload="metadata"
			className="h-full w-full select-none object-cover [transform:translateZ(0)]"
			draggable={false}
			onMouseEnter={(e) => e.currentTarget.play().catch(() => undefined)}
			onMouseLeave={(e) => {
				e.currentTarget.pause();
				e.currentTarget.currentTime = 0;
			}}
		/>
	);
}

/**
 * Renders extension-contributed settings fields (toggle, slider, select, color, text).
 */
function ExtensionSettingsSection({
	extensionId,
	label,
	fields,
}: {
	extensionId: string;
	label: string;
	fields: ExtensionSettingField[];
}) {
	const [, forceUpdate] = useState(0);

	return (
		<div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-foreground/[0.06]">
			<p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
				{label}
			</p>
			{fields.map((field) => {
				const value =
					extensionHost.getExtensionSetting(extensionId, field.id) ?? field.defaultValue;

				if (field.type === "toggle") {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground">{field.label}</span>
							<Switch
								checked={Boolean(value)}
								onCheckedChange={(checked) => {
									extensionHost.setExtensionSetting(
										extensionId,
										field.id,
										checked,
									);
									forceUpdate((n) => n + 1);
								}}
								className="data-[state=checked]:bg-[#2563EB] scale-75"
							/>
						</div>
					);
				}

				if (field.type === "slider") {
					const step = field.step ?? 0.01;
					const precision = getStepPrecision(step);
					return (
						<div key={field.id} className="mt-1">
							<SliderControl
								label={field.label}
								value={
									typeof value === "number"
										? value
										: (field.defaultValue as number)
								}
								defaultValue={field.defaultValue as number}
								min={field.min ?? 0}
								max={field.max ?? 1}
								step={step}
								onChange={(v) => {
									extensionHost.setExtensionSetting(extensionId, field.id, v);
									forceUpdate((n) => n + 1);
								}}
								formatValue={(v) => v.toFixed(precision)}
								parseInput={(text) => parseFloat(text)}
							/>
						</div>
					);
				}

				if (field.type === "select" && field.options) {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground flex-shrink-0">
								{field.label}
							</span>
							<Select
								value={String(value)}
								onValueChange={(v) => {
									extensionHost.setExtensionSetting(extensionId, field.id, v);
									forceUpdate((n) => n + 1);
								}}
							>
								<SelectTrigger className="h-6 w-24 text-[10px] border-foreground/10 bg-foreground/[0.03]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{field.options.map((opt) => (
										<SelectItem
											key={opt.value}
											value={opt.value}
											className="text-[10px]"
										>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					);
				}

				if (field.type === "color") {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground flex-shrink-0">
								{field.label}
							</span>
							<input
								type="color"
								value={String(value)}
								onChange={(e) => {
									extensionHost.setExtensionSetting(
										extensionId,
										field.id,
										e.target.value,
									);
									forceUpdate((n) => n + 1);
								}}
								className="w-7 h-5 rounded border border-foreground/10 cursor-pointer bg-transparent"
							/>
						</div>
					);
				}

				if (field.type === "text") {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground flex-shrink-0">
								{field.label}
							</span>
							<input
								type="text"
								value={String(value)}
								onChange={(e) => {
									extensionHost.setExtensionSetting(
										extensionId,
										field.id,
										e.target.value,
									);
									forceUpdate((n) => n + 1);
								}}
								className="w-24 h-6 rounded bg-foreground/[0.06] border border-foreground/10 px-1.5 text-[10px] text-foreground"
							/>
						</div>
					);
				}

				return null;
			})}
		</div>
	);
}

const MOTION_PRESET_ORDER: CursorMotionPresetId[] = ["focused", "smooth"];

function MotionPresetCards({
	title,
	activePresetId,
	onApply,
	tSettings,
}: {
	title: string;
	activePresetId: CursorMotionPresetId | null;
	onApply: (presetId: CursorMotionPresetId) => void;
	tSettings: (key: string, fallback?: string) => string;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="text-[10px] text-muted-foreground">{title}</div>
			<div className="grid grid-cols-2 gap-2">
				{MOTION_PRESET_ORDER.map((presetId) => {
					const Icon = presetId === "focused" ? CursorClick : PresentationChart;
					const isActive = activePresetId === presetId;

					return (
						<button
							key={presetId}
							type="button"
							onClick={() => onApply(presetId)}
							className={cn(
								"rounded-xl border px-3 py-3 text-left transition-all",
								"border-foreground/10 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.06]",
								isActive &&
									"border-[#2563EB]/70 bg-[#2563EB]/12 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]",
							)}
						>
							<div className="flex items-start gap-3">
								<div
									className={cn(
										"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-black/10 text-muted-foreground",
										isActive &&
											"border-[#2563EB]/30 bg-[#2563EB]/10 text-[#75A6FF]",
									)}
								>
									<Icon className="h-4 w-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-[12px] font-medium text-foreground">
										{tSettings(`effects.motionPresets.${presetId}.label`)}
									</div>
								</div>
							</div>
							<div className="mt-2 text-[10px] leading-4 text-muted-foreground">
								{tSettings(`effects.motionPresets.${presetId}.description`)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

interface SettingsPanelProps {
	panelMode?: "editor" | "background";
	activeEffectSection?: EditorEffectSection;
	selected: string;
	onWallpaperChange: (path: string) => void;
	selectedZoomDepth?: ZoomDepth | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	selectedZoomId?: string | null;
	selectedZoomMode?: ZoomMode | null;
	onZoomModeChange?: (mode: ZoomMode) => void;
	onZoomDelete?: (id: string) => void;
	selectedClipId?: string | null;
	selectedClipSpeed?: number | null;
	selectedClipMuted?: boolean | null;
	selectedClipShowSourceAudio?: boolean | null;
	hasClipSourceAudio?: boolean;
	onClipSpeedChange?: (speed: number) => void;
	onClipMutedChange?: (muted: boolean) => void;
	onClipShowSourceAudioChange?: (show: boolean) => void;
	sourceAudioTrackMeta?: Array<{ id: string; label: string }>;
	sourceAudioTrackSettings?: Record<string, { volume: number; normalize: boolean }>;
	onSourceAudioTrackVolumeChange?: (id: string, volume: number) => void;
	onSourceAudioTrackNormalizeChange?: (id: string, normalize: boolean) => void;
	onClipDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	selectedAudioVolume?: number | null;
	selectedAudioNormalize?: boolean | null;
	selectedAudioFadeInMs?: number | null;
	selectedAudioFadeOutMs?: number | null;
	audioRegions?: AudioRegion[];
	timelinePlayheadTimeMs?: number;
	onAudioVolumeChange?: (volume: number) => void;
	onAudioNormalizeChange?: (normalize: boolean) => void;
	onAudioFadeInChange?: (fadeInMs: number) => void;
	onAudioFadeOutChange?: (fadeOutMs: number) => void;
	onAudioSplit?: (audioId?: string | null) => void;
	onAddAudio?: () => void;
	onSelectAudio?: (id: string | null) => void;
	onAudioDelete?: (id: string) => void;
	shadowIntensity?: number;
	onShadowChange?: (intensity: number) => void;
	backgroundBlur?: number;
	onBackgroundBlurChange?: (amount: number) => void;
	zoomMotionBlurTuning?: ZoomMotionBlurTuning;
	onZoomMotionBlurTuningChange?: (tuning: ZoomMotionBlurTuning) => void;
	zoomTemporalMotionBlur?: number;
	onZoomTemporalMotionBlurChange?: (amount: number) => void;
	zoomMotionBlurSampleCount?: number | null;
	onZoomMotionBlurSampleCountChange?: (count: number | null) => void;
	zoomMotionBlurShutterFraction?: number | null;
	onZoomMotionBlurShutterFractionChange?: (fraction: number | null) => void;
	connectZooms?: boolean;
	onConnectZoomsChange?: (enabled: boolean) => void;
	zoomSpeed?: ZoomSpeed;
	onZoomSpeedChange?: (speed: ZoomSpeed) => void;
	autoApplyFreshRecordingAutoZooms?: boolean;
	onAutoApplyFreshRecordingAutoZoomsChange?: (enabled: boolean) => void;
	zoomInDurationMs?: number;
	onZoomInDurationMsChange?: (duration: number) => void;
	zoomInOverlapMs?: number;
	onZoomInOverlapMsChange?: (duration: number) => void;
	zoomOutDurationMs?: number;
	onZoomOutDurationMsChange?: (duration: number) => void;
	connectedZoomGapMs?: number;
	onConnectedZoomGapMsChange?: (duration: number) => void;
	connectedZoomDurationMs?: number;
	onConnectedZoomDurationMsChange?: (duration: number) => void;
	zoomInEasing?: ZoomTransitionEasing;
	onZoomInEasingChange?: (easing: ZoomTransitionEasing) => void;
	zoomOutEasing?: ZoomTransitionEasing;
	onZoomOutEasingChange?: (easing: ZoomTransitionEasing) => void;
	connectedZoomEasing?: ZoomTransitionEasing;
	onConnectedZoomEasingChange?: (easing: ZoomTransitionEasing) => void;
	showCursor?: boolean;
	onShowCursorChange?: (enabled: boolean) => void;
	loopCursor?: boolean;
	onLoopCursorChange?: (enabled: boolean) => void;
	cursorStyle?: CursorStyle;
	onCursorStyleChange?: (style: CursorStyle) => void;
	cursorSize?: number;
	onCursorSizeChange?: (size: number) => void;
	cursorSmoothing?: number;
	onCursorSmoothingChange?: (smoothing: number) => void;
	cursorSpringStiffnessMultiplier?: number;
	onCursorSpringStiffnessMultiplierChange?: (multiplier: number) => void;
	cursorSpringDampingMultiplier?: number;
	onCursorSpringDampingMultiplierChange?: (multiplier: number) => void;
	cursorSpringMassMultiplier?: number;
	onCursorSpringMassMultiplierChange?: (multiplier: number) => void;
	cameraSpringStiffnessMultiplier?: number;
	onCameraSpringStiffnessMultiplierChange?: (multiplier: number) => void;
	cameraSpringDampingMultiplier?: number;
	onCameraSpringDampingMultiplierChange?: (multiplier: number) => void;
	cameraSpringMassMultiplier?: number;
	onCameraSpringMassMultiplierChange?: (multiplier: number) => void;
	zoomClassicMode?: boolean;
	onZoomClassicModeChange?: (enabled: boolean) => void;
	cursorMotionBlur?: number;
	onCursorMotionBlurChange?: (amount: number) => void;
	cursorClickBounce?: number;
	onCursorClickBounceChange?: (amount: number) => void;
	cursorClickBounceDuration?: number;
	onCursorClickBounceDurationChange?: (duration: number) => void;
	showClickEffect?: boolean;
	smartCameraEnabled?: boolean;
	onSmartCameraEnabledChange?: (enabled: boolean) => void;
	smartCameraScale?: number;
	onSmartCameraScaleChange?: (scale: number) => void;
	onShowClickEffectChange?: (show: boolean) => void;
	clickEffectStyle?: string;
	onClickEffectStyleChange?: (style: string) => void;
	clickEffectSize?: number;
	onClickEffectSizeChange?: (size: number) => void;
	clickSound?: boolean;
	onClickSoundChange?: (enabled: boolean) => void;
	clickSoundStyle?: ClickSoundStyle;
	onClickSoundStyleChange?: (style: ClickSoundStyle) => void;
	clickSoundVolume?: number;
	onClickSoundVolumeChange?: (volume: number) => void;
	cursorSway?: number;
	onCursorSwayChange?: (amount: number) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	webcam?: WebcamOverlaySettings;
	webcamPreviewSrc?: string | null;
	webcamPreviewCurrentTime?: number;
	webcamPreviewPlaying?: boolean;
	onWebcamChange?: (webcam: WebcamOverlaySettings) => void;
	onUploadWebcam?: () => void;
	onRecordWebcam?: () => void;
	onClearWebcam?: () => void;
	padding?: Padding;
	onPaddingChange?: (padding: Padding) => void;
	frame?: string | null;
	onFrameChange?: (frameId: string | null) => void;
	cropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	onAspectRatioChange?: (ratio: AspectRatio) => void;
	selectedAnnotationId?: string | null;
	annotationRegions?: AnnotationRegion[];
	onAnnotationContentChange?: (id: string, content: string) => void;
	onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
	onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion["style"]>) => void;
	onAnnotationFigureDataChange?: (id: string, figureData: FigureData) => void;
	onAnnotationBlurIntensityChange?: (id: string, intensity: number) => void;
	onAnnotationBlurColorChange?: (id: string, color: string) => void;
	onAnnotationDelete?: (id: string) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onAddAnnotation?: () => void;
	onAnnotationSizeChange?: (id: string, size: { width: number; height: number }) => void;
	nativeCaptureUnavailableSession?: boolean;
	onOpenNativeCaptureUnavailableModal?: () => void;
}

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
	{ depth: 1, label: "1.25×" },
	{ depth: 2, label: "1.5×" },
	{ depth: 3, label: "1.8×" },
	{ depth: 4, label: "2.2×" },
	{ depth: 5, label: "3.5×" },
	{ depth: 6, label: "5×" },
];

const WEBCAM_POSITION_PRESETS: Array<{
	preset: Exclude<WebcamPositionPreset, "custom">;
	label: string;
}> = [
	{ preset: "top-left", label: "↖" },
	{ preset: "top-center", label: "↑" },
	{ preset: "top-right", label: "↗" },
	{ preset: "center-left", label: "←" },
	{ preset: "center", label: "•" },
	{ preset: "center-right", label: "→" },
	{ preset: "bottom-left", label: "↙" },
	{ preset: "bottom-center", label: "↓" },
	{ preset: "bottom-right", label: "↘" },
];

type CursorStyleOption = { value: CursorStyle; label: string };

type WallpaperTile = {
	key: string;
	label: string;
	value: string;
	previewUrl: string;
};

const BUILTIN_CURSOR_STYLE_OPTIONS: CursorStyleOption[] = [
	{ value: "macos", label: "macOS" },
	{ value: "tahoe", label: "Tahoe" },
	{ value: "tahoe-inverted", label: "Tahoe Inverted" },
	{ value: "dot", label: "White" },
	{ value: "figma", label: "Minimal" },
	{ value: "neon", label: "Neon" },
	{ value: "glow", label: "Glow" },
	{ value: "gradient", label: "Gradient" },
];

const APP_LANGUAGE_LABELS: Record<AppLocale, string> = {
	vi: "Tiếng Việt",
	en: "English",
};

function loadPreviewImage(url: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Failed to load preview asset: ${url}`));
		image.src = url;
	});
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

async function createTrimmedSvgPreview(
	url: string,
	sampleSize: number,
	trim?: { x: number; y: number; width: number; height: number },
) {
	const image = await loadPreviewImage(url);
	const sourceCanvas = document.createElement("canvas");
	sourceCanvas.width = sampleSize;
	sourceCanvas.height = sampleSize;
	const sourceCtx = sourceCanvas.getContext("2d")!;
	sourceCtx.drawImage(image, 0, 0, sampleSize, sampleSize);

	if (trim) {
		const croppedCanvas = document.createElement("canvas");
		croppedCanvas.width = trim.width;
		croppedCanvas.height = trim.height;
		const croppedCtx = croppedCanvas.getContext("2d")!;
		croppedCtx.drawImage(
			sourceCanvas,
			trim.x,
			trim.y,
			trim.width,
			trim.height,
			0,
			0,
			trim.width,
			trim.height,
		);
		return croppedCanvas.toDataURL("image/png");
	}

	return trimCanvasToAlpha(sourceCanvas).dataUrl;
}

async function createInvertedPreview(url: string) {
	const image = await loadPreviewImage(url);
	const canvas = document.createElement("canvas");
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(image, 0, 0);
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
	return canvas.toDataURL("image/png");
}

function CursorStylePreview({
	style,
	previewUrls,
}: {
	style: CursorStyle;
	previewUrls: Partial<Record<string, string>>;
}) {
	const previewSrc =
		style === "macos"
			? (previewUrls.macos ?? tahoeCursorUrl)
			: style === "tahoe"
				? (previewUrls.tahoe ?? tahoeCursorUrl)
				: style === "figma"
					? (previewUrls.figma ?? minimalCursorUrl)
					: style === "tahoe-inverted"
						? (previewUrls["tahoe-inverted"] ?? tahoeCursorUrl)
						: previewUrls[style];

	if (style === "macos" || style === "tahoe" || style === "tahoe-inverted") {
		const previewSize = BUILTIN_CURSOR_PREVIEW_SIZE * getCursorStyleSizeMultiplier(style);
		return (
			<div
				className="flex items-center justify-center"
				style={{
					width: `${BUILTIN_CURSOR_PREVIEW_FRAME_SIZE}px`,
					height: `${BUILTIN_CURSOR_PREVIEW_FRAME_SIZE}px`,
				}}
			>
				<img
					src={previewSrc ?? tahoeCursorUrl}
					alt=""
					className="max-w-none object-contain drop-shadow-[0_8px_12px_rgba(15,23,42,0.18)]"
					draggable={false}
					style={{
						width: `${previewSize}px`,
						height: `${previewSize}px`,
					}}
				/>
			</div>
		);
	}

	if (style === "figma") {
		return <img src={previewSrc} alt="" className="h-7 w-7 object-contain" draggable={false} />;
	}

	/* Cursor pack styles: dot (white arrow), neon, outline, glow, gradient, extensions */
	return (
		<img
			src={previewSrc ?? tahoeCursorUrl}
			alt=""
			className="h-8 w-8 object-contain"
			draggable={false}
		/>
	);
}

export function SettingsPanel({
	panelMode = "editor",
	activeEffectSection: activeEffectSectionProp,
	selected,
	onWallpaperChange,
	selectedZoomDepth,
	onZoomDepthChange,
	selectedZoomId,
	selectedZoomMode,
	onZoomModeChange,
	onZoomDelete,
	selectedClipId,
	selectedClipSpeed,
	selectedClipMuted,
	selectedClipShowSourceAudio = false,
	hasClipSourceAudio = false,
	onClipSpeedChange,
	onClipMutedChange,
	onClipShowSourceAudioChange,
	sourceAudioTrackMeta = [],
	sourceAudioTrackSettings = {},
	onSourceAudioTrackVolumeChange,
	onSourceAudioTrackNormalizeChange,
	onClipDelete,
	selectedAudioId,
	selectedAudioVolume,
	selectedAudioNormalize,
	selectedAudioFadeInMs,
	selectedAudioFadeOutMs,
	audioRegions = [],
	timelinePlayheadTimeMs,
	onAudioVolumeChange,
	onAudioNormalizeChange,
	onAudioFadeInChange,
	onAudioFadeOutChange,
	onAudioSplit,
	onAddAudio,
	onSelectAudio,
	onAudioDelete,
	shadowIntensity = 0.67,
	onShadowChange,
	backgroundBlur = 0,
	onBackgroundBlurChange,
	zoomMotionBlurTuning = DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	onZoomMotionBlurTuningChange,
	connectZooms: _connectZooms = true,
	onConnectZoomsChange: _onConnectZoomsChange,
	zoomSpeed = DEFAULT_ZOOM_SPEED,
	onZoomSpeedChange,
	autoApplyFreshRecordingAutoZooms = true,
	onAutoApplyFreshRecordingAutoZoomsChange,
	zoomInDurationMs = DEFAULT_ZOOM_IN_DURATION_MS,
	onZoomInDurationMsChange,
	zoomOutDurationMs = DEFAULT_ZOOM_OUT_DURATION_MS,
	onZoomOutDurationMsChange,
	showCursor = false,
	onShowCursorChange,
	loopCursor: _loopCursor = false,
	onLoopCursorChange: _onLoopCursorChange,
	cursorStyle = DEFAULT_CURSOR_STYLE,
	onCursorStyleChange,
	cursorSize = 5,
	onCursorSizeChange,
	cursorSmoothing = 2,
	onCursorSmoothingChange,
	cursorSpringStiffnessMultiplier = 1,
	onCursorSpringStiffnessMultiplierChange,
	cursorSpringDampingMultiplier = 1,
	onCursorSpringDampingMultiplierChange,
	cursorSpringMassMultiplier = 1,
	onCursorSpringMassMultiplierChange,
	cameraSpringStiffnessMultiplier = 1,
	onCameraSpringStiffnessMultiplierChange,
	cameraSpringDampingMultiplier = 1.13,
	onCameraSpringDampingMultiplierChange,
	cameraSpringMassMultiplier = 1.12,
	onCameraSpringMassMultiplierChange,
	zoomClassicMode: _zoomClassicMode = false,
	onZoomClassicModeChange,
	cursorMotionBlur = DEFAULT_CURSOR_MOTION_BLUR,
	onCursorMotionBlurChange,
	cursorClickBounce = 1,
	onCursorClickBounceChange,
	cursorClickBounceDuration = DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	onCursorClickBounceDurationChange,
	onShowClickEffectChange,
	showClickEffect = true,
	smartCameraEnabled = false,
	onSmartCameraEnabledChange,
	smartCameraScale = 1.5,
	onSmartCameraScaleChange,
	clickEffectStyle = "ring",
	onClickEffectStyleChange,
	clickEffectSize = 1,
	onClickEffectSizeChange,
	clickSound = false,
	onClickSoundChange,
	clickSoundStyle = "mechanical",
	onClickSoundStyleChange,
	clickSoundVolume = 0.7,
	onClickSoundVolumeChange,
	cursorSway = DEFAULT_CURSOR_SWAY,
	onCursorSwayChange,
	borderRadius = 12.5,
	onBorderRadiusChange,
	webcam,
	webcamPreviewSrc = null,
	webcamPreviewCurrentTime = 0,
	webcamPreviewPlaying = false,
	onWebcamChange,
	onUploadWebcam,
	onRecordWebcam,
	onClearWebcam,
	padding = DEFAULT_PADDING,
	onPaddingChange,
	frame = null,
	onFrameChange,
	aspectRatio,
	onAspectRatioChange,
	selectedAnnotationId,
	annotationRegions = [],
	onAnnotationContentChange,
	onAnnotationTypeChange,
	onAnnotationStyleChange,
	onAnnotationFigureDataChange,
	onAnnotationBlurIntensityChange,
	onAnnotationBlurColorChange,
	onAnnotationDelete,
	onSelectAnnotation,
	onAddAnnotation,
	onAnnotationSizeChange,
	nativeCaptureUnavailableSession = false,
	onOpenNativeCaptureUnavailableModal,
}: SettingsPanelProps) {
	const tSettings = useScopedT("settings");
	const { locale, setLocale, t } = useI18n();
	const { preference, setPreference } = useTheme();
	const isBackgroundPanel = panelMode === "background";
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const [builtInWallpapers, setBuiltInWallpapers] =
		useState<BuiltInWallpaper[]>(BUILT_IN_WALLPAPERS);
	const [extensionWallpapers, setExtensionWallpapers] = useState<
		ReturnType<typeof extensionHost.getContributedWallpapers>
	>([]);
	const [wallpaperPreviewPaths, setWallpaperPreviewPaths] = useState<string[]>([]);
	const [extensionWallpaperPreviewUrls, setExtensionWallpaperPreviewUrls] = useState<
		Record<string, string>
	>({});
	const [customImages, setCustomImages] = useState<string[]>(
		initialEditorPreferences.customWallpapers,
	);
	const removeBackgroundStateRef = useRef<{
		aspectRatio: AspectRatio;
		padding: Padding;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const builtInWallpaperPaths = useMemo(
		() => builtInWallpapers.map((wallpaper) => wallpaper.publicPath),
		[builtInWallpapers],
	);
	const extensionWallpaperPaths = useMemo(
		() => extensionWallpapers.map((wallpaper) => wallpaper.resolvedUrl),
		[extensionWallpapers],
	);
	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const availableWallpapers = await getAvailableWallpapers();
				const resolved = await Promise.all(
					availableWallpapers.map(async (wallpaper) => {
						const assetUrl = await getAssetPath(wallpaper.relativePath);
						// Use tiny thumbnails for the grid; full-res loads on selection
						if (isVideoWallpaperSource(wallpaper.publicPath)) {
							return getRenderableVideoUrl(assetUrl);
						}
						return getWallpaperThumbnailUrl(assetUrl);
					}),
				);
				if (mounted) {
					setBuiltInWallpapers(availableWallpapers);
					setWallpaperPreviewPaths(resolved);
				}
			} catch {
				if (mounted) {
					setBuiltInWallpapers(BUILT_IN_WALLPAPERS);
					setWallpaperPreviewPaths(
						BUILT_IN_WALLPAPERS.map((wallpaper) => wallpaper.publicPath),
					);
				}
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		const updateExtensionAssets = async () => {
			const wallpapers = extensionHost.getContributedWallpapers();
			const cursorStyles = extensionHost.getContributedCursorStyles();
			const [wallpaperPreviewEntries, cursorPreviewEntries] = await Promise.all([
				Promise.all(
					wallpapers.map(
						async (wallpaper) =>
							[
								wallpaper.id,
								isVideoWallpaperSource(wallpaper.resolvedThumbnailUrl)
									? wallpaper.resolvedThumbnailUrl
									: await getWallpaperThumbnailUrl(
											wallpaper.resolvedThumbnailUrl,
										),
							] as const,
					),
				),
				Promise.all(
					cursorStyles.map(
						async (cursorStyle) =>
							[
								cursorStyle.id,
								await getRenderableAssetUrl(cursorStyle.resolvedDefaultUrl),
							] as const,
					),
				),
			]);

			if (cancelled) {
				return;
			}

			setExtensionWallpapers(wallpapers);
			setExtensionWallpaperPreviewUrls(Object.fromEntries(wallpaperPreviewEntries));
			setExtensionCursorStyles(cursorStyles);
			setExtensionCursorPreviewUrls(Object.fromEntries(cursorPreviewEntries));
		};

		void extensionHost.autoActivateBuiltins().then(updateExtensionAssets);
		const unsubscribe = extensionHost.onChange(() => {
			void updateExtensionAssets();
		});

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);
	const removeBackgroundEnabled = aspectRatio === "native" && isZeroPadding(padding);

	// Device frames from extension system
	const [availableFrames, setAvailableFrames] = useState<FrameInstance[]>([]);
	useEffect(() => {
		const update = () => setAvailableFrames(extensionHost.getFrames());
		update();
		return extensionHost.onChange(update);
	}, []);

	// Extension-contributed settings panels
	const [extensionPanels, setExtensionPanels] = useState<
		ReturnType<typeof extensionHost.getSettingsPanels>
	>([]);
	useEffect(() => {
		const update = () => setExtensionPanels(extensionHost.getSettingsPanels());
		update();
		return extensionHost.onChange(update);
	}, []);

	const renderExtensionPanelsForSections = (...sections: string[]) =>
		extensionPanels
			.filter((panel) => {
				const parentSection = panel.panel.parentSection;
				return parentSection ? sections.includes(parentSection) : false;
			})
			.map((panel) => (
				<ExtensionSettingsSection
					key={`${panel.extensionId}/${panel.panel.id}`}
					extensionId={panel.extensionId}
					label={panel.panel.label}
					fields={panel.panel.fields}
				/>
			));

	const [backgroundTab, setBackgroundTab] = useState<BackgroundTab>(() =>
		getBackgroundTabForWallpaper(selected),
	);
	const defaultWebcam = initialEditorPreferences.webcam;
	const [internalActiveEffectSection] = useState<EditorEffectSection>("scene");
	const activeEffectSection = activeEffectSectionProp ?? internalActiveEffectSection;
	const [extensionCursorStyles, setExtensionCursorStyles] = useState<
		ReturnType<typeof extensionHost.getContributedCursorStyles>
	>([]);
	const [builtInCursorPreviewUrls, setBuiltInCursorPreviewUrls] = useState<
		Partial<Record<string, string>>
	>({});
	const [extensionCursorPreviewUrls, setExtensionCursorPreviewUrls] = useState<
		Partial<Record<string, string>>
	>({});
	const cursorPreviewUrls = useMemo(
		() => ({ ...builtInCursorPreviewUrls, ...extensionCursorPreviewUrls }),
		[builtInCursorPreviewUrls, extensionCursorPreviewUrls],
	);
	const showDevMotionControls = false;
	const cursorStyleOptions = useMemo<CursorStyleOption[]>(
		() => [
			...BUILTIN_CURSOR_STYLE_OPTIONS,
			...extensionCursorStyles.map((cursorStyle) => ({
				value: cursorStyle.id as CursorStyle,
				label: cursorStyle.cursorStyle.label,
			})),
		],
		[extensionCursorStyles],
	);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			try {
				const macosPreview = cursorSetAssets.macos.arrow.url;
				const tahoePreview = cursorSetAssets.tahoe.arrow.url;
				const minimalPreview = await createTrimmedSvgPreview(minimalCursorUrl, 512);
				const invertedPreview = await createInvertedPreview(tahoePreview);

				if (!cancelled) {
					setBuiltInCursorPreviewUrls({
						macos: macosPreview,
						tahoe: tahoePreview,
						figma: minimalPreview,
						"tahoe-inverted": invertedPreview,
						dot: WHITE_ARROW_PREVIEW,
						neon: NEON_ARROW_PREVIEW,
						glow: GLOW_ARROW_PREVIEW,
						gradient: GRADIENT_ARROW_PREVIEW,
					});
				}
			} catch {
				if (!cancelled) {
					setBuiltInCursorPreviewUrls({
						macos: tahoeCursorUrl,
						tahoe: tahoeCursorUrl,
						figma: minimalCursorUrl,
						"tahoe-inverted": tahoeCursorUrl,
						dot: WHITE_ARROW_PREVIEW,
						neon: NEON_ARROW_PREVIEW,
						glow: GLOW_ARROW_PREVIEW,
						gradient: GRADIENT_ARROW_PREVIEW,
					});
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setBackgroundTab(getBackgroundTabForWallpaper(selected));
	}, [selected]);

	useEffect(() => {
		if (selected.startsWith("data:image")) {
			setCustomImages((prev) => (prev.includes(selected) ? prev : [selected, ...prev]));
			return;
		}

		const isKnownWallpaper =
			builtInWallpaperPaths.includes(selected) ||
			wallpaperPreviewPaths.includes(selected) ||
			extensionWallpaperPaths.includes(selected);

		if (!isKnownWallpaper && isVideoWallpaperSource(selected)) {
			setCustomImages((prev) => (prev.includes(selected) ? prev : [selected, ...prev]));
		}
	}, [builtInWallpaperPaths, extensionWallpaperPaths, selected, wallpaperPreviewPaths]);

	const imageWallpaperTiles = useMemo<WallpaperTile[]>(() => {
		const imageWallpapers = builtInWallpapers.filter(
			(wallpaper) => !isVideoWallpaperSource(wallpaper.publicPath),
		);
		const builtInTiles = (
			wallpaperPreviewPaths.length > 0 ? wallpaperPreviewPaths : builtInWallpaperPaths
		)
			.filter((path) => !isVideoWallpaperSource(path))
			.map((previewPath, index) => {
				const wallpaper = imageWallpapers[index];
				return {
					key: wallpaper ? `builtin/${wallpaper.id}` : previewPath,
					label: wallpaper?.label ?? `Wallpaper ${index + 1}`,
					value: wallpaper?.publicPath ?? previewPath,
					previewUrl: previewPath,
				};
			});

		const extensionTiles = extensionWallpapers
			.filter((wallpaper) => !isVideoWallpaperSource(wallpaper.resolvedUrl))
			.map((wallpaper) => ({
				key: wallpaper.id,
				label: wallpaper.wallpaper.label,
				value: wallpaper.resolvedUrl,
				previewUrl:
					extensionWallpaperPreviewUrls[wallpaper.id] ?? wallpaper.resolvedThumbnailUrl,
			}));

		return [...builtInTiles, ...extensionTiles];
	}, [
		builtInWallpaperPaths,
		builtInWallpapers,
		extensionWallpaperPreviewUrls,
		extensionWallpapers,
		wallpaperPreviewPaths,
	]);

	const videoWallpaperTiles = useMemo<WallpaperTile[]>(() => {
		const builtInTiles = builtInWallpapers
			.filter((wallpaper) => isVideoWallpaperSource(wallpaper.publicPath))
			.map((wallpaper) => ({
				key: `builtin/${wallpaper.id}`,
				label: wallpaper.label,
				value: wallpaper.publicPath,
				previewUrl: wallpaper.publicPath,
			}));

		const extensionTiles = extensionWallpapers
			.filter((wallpaper) => isVideoWallpaperSource(wallpaper.resolvedUrl))
			.map((wallpaper) => ({
				key: wallpaper.id,
				label: wallpaper.wallpaper.label,
				value: wallpaper.resolvedUrl,
				previewUrl:
					extensionWallpaperPreviewUrls[wallpaper.id] ?? wallpaper.resolvedThumbnailUrl,
			}));

		return [...builtInTiles, ...extensionTiles];
	}, [builtInWallpapers, extensionWallpaperPreviewUrls, extensionWallpapers]);

	useEffect(() => {
		saveEditorPreferences({ customWallpapers: customImages });
	}, [customImages]);

	const handleRemoveBackgroundToggle = (checked: boolean) => {
		if (checked) {
			removeBackgroundStateRef.current = {
				aspectRatio,
				padding,
			};
			onAspectRatioChange?.("native");
			onPaddingChange?.({ top: 0, bottom: 0, left: 0, right: 0, linked: padding.linked });
			return;
		}

		const previousState = removeBackgroundStateRef.current;
		if (previousState) {
			onAspectRatioChange?.(previousState.aspectRatio);
			onPaddingChange?.(previousState.padding);
			removeBackgroundStateRef.current = null;
			return;
		}

		// Fallback if the project loaded in a "background removed" state already
		onAspectRatioChange?.(initialEditorPreferences.aspectRatio);
		onPaddingChange?.({ ...DEFAULT_PADDING });
	};

	const togglePaddingLink = () => {
		const isLinked = padding.linked !== false;
		const nextLinked = !isLinked;
		if (nextLinked) {
			// Compute average for relinking to avoid sudden shifts
			const avg = Math.round(
				(padding.top + padding.bottom + padding.left + padding.right) / 4,
			);
			onPaddingChange?.({
				top: avg,
				bottom: avg,
				left: avg,
				right: avg,
				linked: true,
			});
		} else {
			onPaddingChange?.({
				...padding,
				linked: false,
			});
		}
	};

	const handlePaddingSideChange = (side: keyof Padding, value: number) => {
		if (padding.linked !== false) {
			onPaddingChange?.({
				top: value,
				bottom: value,
				left: value,
				right: value,
				linked: true,
			});
		} else {
			onPaddingChange?.({
				...padding,
				[side]: value,
			});
		}
	};

	const webcamFileName = webcam?.sourcePath?.split(/[\\/]/).pop() ?? null;
	const webcamPositionPreset = webcam?.positionPreset ?? DEFAULT_WEBCAM_POSITION_PRESET;
	const webcamPositionX = webcam?.positionX ?? DEFAULT_WEBCAM_POSITION_X;
	const webcamPositionY = webcam?.positionY ?? DEFAULT_WEBCAM_POSITION_Y;
	const webcamCrop = normalizeWebcamCropRegion(webcam?.cropRegion);

	const getWallpaperTileState = (candidateValue: string, previewPath?: string) => {
		if (!selected) return false;
		if (selected === candidateValue || (previewPath && selected === previewPath)) return true;
		try {
			const clean = (s: string) => s.replace(/^file:\/\//, "").replace(/^\//, "");
			if (clean(selected).endsWith(clean(candidateValue))) return true;
			if (clean(candidateValue).endsWith(clean(selected))) return true;
			if (previewPath && clean(selected).endsWith(clean(previewPath))) return true;
			if (previewPath && clean(previewPath).endsWith(clean(selected))) return true;
		} catch {
			return false;
		}
		return false;
	};

	const wallpaperTileClass = (isSelected: boolean) =>
		cn(
			"group relative aspect-square w-full overflow-hidden rounded-xl border transition-all duration-150 cursor-pointer",
			isSelected
				? "border-blue-500 ring-2 ring-blue-500/30 shadow-sm scale-[1.03]"
				: "border-foreground/10 hover:border-foreground/25 hover:scale-[1.02]",
		);

	const renderWallpaperImageTile = (
		wallpaperUrl: string,
		isSelected: boolean,
		props?: {
			key?: string;
			ariaLabel?: string;
			title?: string;
			onClick?: () => void;
			children?: React.ReactNode;
		},
	) => (
		<div
			key={props?.key}
			className={wallpaperTileClass(isSelected)}
			aria-label={props?.ariaLabel}
			title={props?.title}
			onClick={props?.onClick}
			role="button"
		>
			<div className="absolute inset-[1px] overflow-hidden rounded-[10px] bg-editor-dialog">
				{isVideoWallpaperSource(wallpaperUrl) ? (
					<WallpaperVideoPreview src={wallpaperUrl} />
				) : (
					<img
						src={wallpaperUrl}
						alt={
							props?.title ??
							props?.ariaLabel ??
							tSettings("background.wallpaperPreview", "Wallpaper preview")
						}
						className="h-full w-full select-none object-cover [transform:translateZ(0)]"
						draggable={false}
					/>
				)}
			</div>
			{props?.children}
		</div>
	);

	const resetBackgroundSection = () => {
		onBackgroundBlurChange?.(initialEditorPreferences.backgroundBlur);

		const preferredWallpaper = initialEditorPreferences.wallpaper;
		const hasPreferredWallpaper =
			(preferredWallpaper && builtInWallpaperPaths.includes(preferredWallpaper)) ||
			(preferredWallpaper && extensionWallpaperPaths.includes(preferredWallpaper)) ||
			(preferredWallpaper && customImages.includes(preferredWallpaper));

		onWallpaperChange(
			(hasPreferredWallpaper ? preferredWallpaper : "") ||
				builtInWallpaperPaths[0] ||
				extensionWallpaperPaths[0] ||
				BUILT_IN_WALLPAPERS[0]?.publicPath ||
				"",
		);
	};

	const resetZoomSection = () => {
		onZoomMotionBlurTuningChange?.(initialEditorPreferences.zoomMotionBlurTuning);
		onCameraSpringStiffnessMultiplierChange?.(
			initialEditorPreferences.cameraSpringStiffnessMultiplier,
		);
		onCameraSpringDampingMultiplierChange?.(
			initialEditorPreferences.cameraSpringDampingMultiplier,
		);
		onCameraSpringMassMultiplierChange?.(initialEditorPreferences.cameraSpringMassMultiplier);
		onZoomInDurationMsChange?.(initialEditorPreferences.zoomInDurationMs);
		onZoomOutDurationMsChange?.(initialEditorPreferences.zoomOutDurationMs);
		onZoomSpeedChange?.(DEFAULT_ZOOM_SPEED);
		onZoomClassicModeChange?.(false);
	};

	const resetCursorSection = () => {
		onShowCursorChange?.(initialEditorPreferences.showCursor);
		_onLoopCursorChange?.(initialEditorPreferences.loopCursor);
		onCursorStyleChange?.(initialEditorPreferences.cursorStyle);
		onCursorSizeChange?.(initialEditorPreferences.cursorSize);
		onCursorSmoothingChange?.(initialEditorPreferences.cursorSmoothing);
		onCursorSpringStiffnessMultiplierChange?.(
			initialEditorPreferences.cursorSpringStiffnessMultiplier,
		);
		onCursorSpringDampingMultiplierChange?.(
			initialEditorPreferences.cursorSpringDampingMultiplier,
		);
		onCursorSpringMassMultiplierChange?.(initialEditorPreferences.cursorSpringMassMultiplier);
		onCursorMotionBlurChange?.(initialEditorPreferences.cursorMotionBlur);
		onCursorClickBounceChange?.(initialEditorPreferences.cursorClickBounce);
		onCursorClickBounceDurationChange?.(DEFAULT_CURSOR_CLICK_BOUNCE_DURATION);
		onCursorSwayChange?.(initialEditorPreferences.cursorSway);
	};

	const activeMotionPresetId = useMemo(() => {
		return (
			getMatchingCursorMotionPresetId({
				zoomInDurationMs,
				zoomOutDurationMs,
				cursorSize,
				cursorSmoothing,
				cursorSpringStiffnessMultiplier,
				cursorSpringDampingMultiplier,
				cursorSpringMassMultiplier,
				cursorMotionBlur,
				cursorClickBounce,
				cursorClickBounceDuration,
			}) ?? "focused"
		);
	}, [
		cursorClickBounce,
		cursorClickBounceDuration,
		cursorMotionBlur,
		cursorSize,
		cursorSmoothing,
		cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier,
		cursorSpringStiffnessMultiplier,
		zoomInDurationMs,
		zoomOutDurationMs,
	]);

	const applyMotionPreset = (presetId: CursorMotionPresetId) => {
		const preset = CURSOR_MOTION_PRESETS[presetId];
		onZoomInDurationMsChange?.(preset.zoomInDurationMs);
		onZoomOutDurationMsChange?.(preset.zoomOutDurationMs);
		onCursorSizeChange?.(preset.cursorSize);
		onCursorSmoothingChange?.(preset.cursorSmoothing);
		onCursorSpringStiffnessMultiplierChange?.(preset.cursorSpringStiffnessMultiplier);
		onCursorSpringDampingMultiplierChange?.(preset.cursorSpringDampingMultiplier);
		onCursorSpringMassMultiplierChange?.(preset.cursorSpringMassMultiplier);
		onCursorMotionBlurChange?.(preset.cursorMotionBlur);
		onCursorClickBounceChange?.(preset.cursorClickBounce);
		onCursorClickBounceDurationChange?.(preset.cursorClickBounceDuration);
	};

	const resetFrameSection = () => {
		const preferredFrame = initialEditorPreferences.frame;
		const resolvedFrame = preferredFrame
			? availableFrames.some((candidate) => candidate.id === preferredFrame)
				? preferredFrame
				: null
			: null;
		onShadowChange?.(initialEditorPreferences.shadowIntensity);
		onBorderRadiusChange?.(initialEditorPreferences.borderRadius);
		onAspectRatioChange?.(initialEditorPreferences.aspectRatio);
		onPaddingChange?.({ ...initialEditorPreferences.padding });
		onFrameChange?.(resolvedFrame);
		removeBackgroundStateRef.current = null;
	};

	const resetWebcamSection = () => {
		if (!onWebcamChange) return;
		onWebcamChange({ ...defaultWebcam });
	};

	const updateWebcam = (patch: Partial<WebcamOverlaySettings>) => {
		if (!webcam || !onWebcamChange) return;
		onWebcamChange({ ...webcam, ...patch });
	};

	const applyWebcamPositionPreset = (preset: WebcamPositionPreset) => {
		if (!webcam) return;

		if (preset === "custom") {
			updateWebcam({ positionPreset: "custom" });
			return;
		}

		const position = getWebcamPositionForPreset(preset);
		updateWebcam({
			positionPreset: preset,
			positionX: position.x,
			positionY: position.y,
			corner: resolveWebcamCorner(preset, webcam.corner),
		});
	};

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate file type - only allow JPG/JPEG
		const validTypes = ["image/jpeg", "image/jpg"];
		if (!validTypes.includes(file.type)) {
			toast.error(tSettings("background.uploadError"), {
				description: tSettings("background.uploadErrorDescription"),
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (dataUrl) {
				setCustomImages((prev) => [...prev, dataUrl]);
				onWallpaperChange(dataUrl);
				toast.success(tSettings("background.uploadSuccess"));
			}
		};

		reader.onerror = () => {
			toast.error(t("common.errors.failedToUploadImage"), {
				description: t("common.errors.fileReadError"),
			});
		};

		reader.readAsDataURL(file);
		// Reset input so the same file can be selected again
		event.target.value = "";
	};

	const handleVideoUpload = async () => {
		try {
			const result = await window.electronAPI.openVideoFilePicker();
			if (!result?.success || !result.path) return;
			const filePath = result.path;
			if (!isVideoWallpaperSource(filePath)) {
				toast.error("Unsupported format", {
					description: "Please select a video file (mp4, webm, mov, etc.)",
				});
				return;
			}
			setCustomImages((prev) => [filePath, ...prev]);
			onWallpaperChange(filePath);
			toast.success("Video background added");
		} catch {
			toast.error("Failed to import video background");
		}
	};

	const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
		event.stopPropagation();
		setCustomImages((prev) => prev.filter((img) => img !== imageUrl));
		// If the removed image was selected, clear selection
		if (selected === imageUrl) {
			onWallpaperChange(
				builtInWallpaperPaths[0] ??
					extensionWallpaperPaths[0] ??
					BUILT_IN_WALLPAPERS[0]?.publicPath ??
					"",
			);
		}
	};

	// Find selected annotation
	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;

	const backgroundSettingsContent = (
		<div className="space-y-4">
			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("background.title")}</SectionLabel>
					<button
						type="button"
						onClick={resetBackgroundSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<SliderControl
					label={tSettings("effects.backgroundBlur")}
					value={backgroundBlur}
					defaultValue={initialEditorPreferences.backgroundBlur}
					min={0}
					max={8}
					step={0.25}
					onChange={(v) => onBackgroundBlurChange?.(v)}
					formatValue={(v) => `${v.toFixed(1)}px`}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
			</section>

			<div className="w-full">
				<LayoutGroup id="background-picker-switcher">
					<div className="grid h-8 w-full grid-cols-2 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-0.5">
						{(
							[
								{ value: "image", label: tSettings("background.image") },
								{ value: "video", label: tSettings("background.video", "Video") },
							] as const
						).map((option) => {
							const isActive = backgroundTab === option.value;
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => setBackgroundTab(option.value)}
									className="relative rounded-lg text-[11px] font-medium tracking-tight transition-colors"
								>
									{isActive ? (
										<motion.span
											layoutId="background-picker-pill"
											className="absolute inset-0 rounded-lg bg-background shadow-sm border border-foreground/[0.08]"
											transition={{
												type: "spring",
												stiffness: 450,
												damping: 35,
											}}
										/>
									) : null}
									<span
										className={cn(
											"relative z-10",
											isActive
												? "text-foreground font-semibold"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{option.label}
									</span>
								</button>
							);
						})}
					</div>
				</LayoutGroup>

				<div className="pt-2">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={backgroundTab}
							initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
							transition={{ duration: 0.2, ease: "easeOut" }}
						>
							{backgroundTab === "image" ? (
								<div className="mt-0 space-y-2">
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleImageUpload}
										accept=".jpg,.jpeg,image/jpeg"
										className="hidden"
									/>
									<Button
										onClick={() => fileInputRef.current?.click()}
										variant="outline"
										className="w-full gap-2 rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-foreground/35 text-foreground text-[11px] font-medium transition-all h-8 shadow-none"
									>
										<Upload className="w-3.5 h-3.5 text-muted-foreground" />
										{tSettings("background.uploadCustom")}
									</Button>

									<div className="grid grid-cols-8 gap-1.5">
										{customImages.map((imageUrl, idx) => {
											const isSelected = getWallpaperTileState(imageUrl);
											return renderWallpaperImageTile(imageUrl, isSelected, {
												key: `custom-${idx}`,
												ariaLabel: isVideoWallpaperSource(imageUrl)
													? (imageUrl.split(/[\\/]/).pop() ??
														tSettings(
															"background.video",
															"Video background",
														))
													: undefined,
												title: isVideoWallpaperSource(imageUrl)
													? imageUrl.split(/[\\/]/).pop()
													: undefined,
												onClick: () => onWallpaperChange(imageUrl),
												children: (
													<button
														onClick={(e) =>
															handleRemoveCustomImage(imageUrl, e)
														}
														className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
													>
														<X className="w-2 h-2 text-white" />
													</button>
												),
											});
										})}

										{imageWallpaperTiles.map((tile) => {
											const isSelected = getWallpaperTileState(
												tile.value,
												tile.previewUrl,
											);
											return renderWallpaperImageTile(
												tile.previewUrl,
												isSelected,
												{
													key: tile.key,
													ariaLabel: tile.label,
													title: tile.label,
													onClick: () => onWallpaperChange(tile.value),
												},
											);
										})}
									</div>
								</div>
							) : (
								<div className="mt-0 space-y-2">
									<Button
										onClick={handleVideoUpload}
										variant="outline"
										className="w-full gap-2 bg-foreground/5 text-foreground border-foreground/10 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-all h-7 text-[10px]"
									>
										<Upload className="w-3 h-3" />
										{tSettings("background.uploadCustomVideo", "Upload Video")}
									</Button>

									<div className="grid grid-cols-8 gap-1.5">
										{customImages
											.filter(isVideoWallpaperSource)
											.map((videoUrl, idx) => {
												const isSelected = getWallpaperTileState(videoUrl);
												return renderWallpaperImageTile(
													videoUrl,
													isSelected,
													{
														key: `custom-video-${idx}`,
														ariaLabel:
															videoUrl.split(/[\\/]/).pop() ??
															"Video background",
														title: videoUrl.split(/[\\/]/).pop(),
														onClick: () => onWallpaperChange(videoUrl),
														children: (
															<button
																onClick={(e) =>
																	handleRemoveCustomImage(
																		videoUrl,
																		e,
																	)
																}
																className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
															>
																<X className="w-2 h-2 text-white" />
															</button>
														),
													},
												);
											})}

										{videoWallpaperTiles.map((wallpaper) => {
											const isSelected = getWallpaperTileState(
												wallpaper.value,
												wallpaper.previewUrl,
											);
											return renderWallpaperImageTile(
												wallpaper.previewUrl,
												isSelected,
												{
													key: wallpaper.key,
													ariaLabel: wallpaper.label,
													title: wallpaper.label,
													onClick: () =>
														onWallpaperChange(wallpaper.value),
												},
											);
										})}
									</div>
								</div>
							)}
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</div>
	);

	// If an annotation is selected, show annotation settings instead
	if (
		!isBackgroundPanel &&
		(activeEffectSection === "annotation" || !activeEffectSection) &&
		selectedAnnotation &&
		onAnnotationContentChange &&
		onAnnotationTypeChange &&
		onAnnotationStyleChange &&
		onAnnotationDelete
	) {
		return (
			<AnnotationSettingsPanel
				annotation={selectedAnnotation}
				annotationRegions={annotationRegions}
				onSelectAnnotation={onSelectAnnotation}
				onAddAnnotation={onAddAnnotation}
				onSizeChange={
					onAnnotationSizeChange
						? (size) => onAnnotationSizeChange(selectedAnnotation.id, size)
						: undefined
				}
				onContentChange={(content) =>
					onAnnotationContentChange(selectedAnnotation.id, content)
				}
				onTypeChange={(type) => onAnnotationTypeChange(selectedAnnotation.id, type)}
				onStyleChange={(style) => onAnnotationStyleChange(selectedAnnotation.id, style)}
				onFigureDataChange={
					onAnnotationFigureDataChange
						? (figureData) =>
								onAnnotationFigureDataChange(selectedAnnotation.id, figureData)
						: undefined
				}
				onBlurIntensityChange={
					onAnnotationBlurIntensityChange
						? (intensity) =>
								onAnnotationBlurIntensityChange(selectedAnnotation.id, intensity)
						: undefined
				}
				onBlurColorChange={
					onAnnotationBlurColorChange
						? (color) => onAnnotationBlurColorChange(selectedAnnotation.id, color)
						: undefined
				}
				onDelete={() => onAnnotationDelete(selectedAnnotation.id)}
			/>
		);
	}

	if (isBackgroundPanel) {
		return (
			<div className="flex-[2] w-[332px] min-w-[280px] max-w-[332px] bg-[#120d26]/85 backdrop-blur-3xl border border-white/[0.12] rounded-[24px] flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.7),0_0_35px_rgba(124,58,237,0.12)] text-white h-full overflow-hidden">
				<div
					className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-0"
					style={{ scrollbarGutter: "stable" }}
				>
					<div className="mb-4 flex items-center gap-2">
						<Palette className="w-4 h-4 text-[#2563EB]" />
						<span className="text-sm font-medium text-foreground">
							{tSettings("background.title")}
						</span>
					</div>
					{backgroundSettingsContent}
				</div>
			</div>
		);
	}

	const smartCameraSectionContent = (
		<section className="flex flex-col gap-2">
			<SectionLabel>{tSettings("sections.smartCamera", "Máy quay thông minh")}</SectionLabel>
			<div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-3.5 shadow-sm transition-all hover:border-foreground/[0.12]">
				<div className="flex items-center justify-between">
					<div className="flex flex-col gap-0.5 min-w-0 pr-3">
						<span className="text-xs font-semibold text-foreground">Auto-Zoom & Pan</span>
						<span className="text-[10px] text-muted-foreground leading-tight">
							Tự động bám theo và zoom vào vị trí chuột
						</span>
					</div>
					<Switch
						checked={smartCameraEnabled}
						onCheckedChange={(checked) => onSmartCameraEnabledChange?.(checked)}
						className="data-[state=checked]:bg-blue-600"
					/>
				</div>
				{smartCameraEnabled && (
					<div className="pt-2.5 mt-2.5 border-t border-foreground/[0.06]">
						<SliderControl
							label="Mức độ Zoom"
							value={smartCameraScale}
							defaultValue={1.5}
							min={1.1}
							max={2.5}
							step={0.1}
							onChange={(v) => onSmartCameraScaleChange?.(v)}
							formatValue={(v) => `+${(v * 100 - 100).toFixed(0)}%`}
							parseInput={(text) => 1.0 + parseFloat(text.replace(/%$/, "")) / 100}
						/>
					</div>
				)}
			</div>
		</section>
	);

	const frameSectionContent = (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<SectionLabel>{tSettings("sections.frame", "Frame")}</SectionLabel>
				<button
					type="button"
					onClick={resetFrameSection}
					className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
				>
					{t("common.actions.reset", "Reset")}
				</button>
			</div>
			<div className="flex flex-col gap-1.5">
				<SliderControl
					label={tSettings("effects.shadow")}
					value={shadowIntensity}
					defaultValue={initialEditorPreferences.shadowIntensity}
					min={0}
					max={1}
					step={0.01}
					onChange={(v) => onShadowChange?.(v)}
					formatValue={(v) => `${Math.round(v * 100)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
				/>
				<SliderControl
					label={tSettings("effects.radius", "Radius")}
					value={borderRadius}
					defaultValue={initialEditorPreferences.borderRadius}
					min={0}
					max={200}
					step={0.5}
					onChange={(v) => onBorderRadiusChange?.(v)}
					formatValue={(v) => `${v}px`}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
				<div className="flex flex-col gap-1.5 pt-0.5">
					<div className="flex items-center justify-between">
						<SectionLabel>{tSettings("effects.padding")}</SectionLabel>
						<button
							type="button"
							onClick={togglePaddingLink}
							aria-pressed={padding.linked === false}
							className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
							title={
								padding.linked === false
									? tSettings(
											"effects.paddingAdvancedHide",
											"Hide advanced padding controls",
										)
									: tSettings(
											"effects.paddingAdvancedShow",
											"Show advanced padding controls",
										)
							}
						>
							{tSettings("effects.paddingAdvanced", "Advanced")}
						</button>
					</div>

					{padding.linked !== false ? (
						<SliderControl
							label={tSettings("effects.paddingLinked", "Đồng đều")}
							value={padding.top}
							defaultValue={DEFAULT_PADDING.top}
							min={0}
							max={100}
							step={1}
							onChange={(v) => handlePaddingSideChange("top", v)}
							formatValue={(v) => `${v}%`}
							parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
						/>
					) : (
						<div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
							<SliderControl
								label={tSettings("effects.paddingTop", "Top")}
								value={padding.top}
								defaultValue={DEFAULT_PADDING.top}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("top", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.paddingBottom", "Bottom")}
								value={padding.bottom}
								defaultValue={DEFAULT_PADDING.bottom}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("bottom", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.paddingLeft", "Left")}
								value={padding.left}
								defaultValue={DEFAULT_PADDING.left}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("left", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.paddingRight", "Right")}
								value={padding.right}
								defaultValue={DEFAULT_PADDING.right}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("right", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
						</div>
					)}
				</div>
				<div className="flex items-center justify-between rounded-xl border border-foreground/[0.07] bg-foreground/[0.02] px-3.5 py-2.5">
					<span className="text-xs font-medium text-foreground/85">
						{tSettings("effects.removeBackground")}
					</span>
					<Switch
						checked={removeBackgroundEnabled}
						onCheckedChange={handleRemoveBackgroundToggle}
						className="data-[state=checked]:bg-blue-600"
					/>
				</div>
				{/* Frame Picker */}
				{availableFrames.length > 0 && (
					<div className="flex flex-col gap-1.5 mt-1">
						<div className="flex items-center justify-between">
							<span className="text-[10px] text-muted-foreground">Frame</span>
							{frame && (
								<button
									type="button"
									onClick={() => onFrameChange?.(null)}
									className="text-[9px] text-[#2563EB] hover:opacity-80"
								>
									Remove
								</button>
							)}
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{availableFrames.map((f) => {
								const isSelected = frame === f.id;
								return (
									<button
										key={f.id}
										type="button"
										onClick={() => onFrameChange?.(isSelected ? null : f.id)}
										className={cn(
											"flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all text-center",
											isSelected
												? "border-[#2563EB]/50 bg-[#2563EB]/10 ring-1 ring-[#2563EB]/30"
												: "border-foreground/[0.06] bg-white/[0.02] hover:bg-foreground/[0.05]",
										)}
									>
										<div className="w-full aspect-video rounded bg-foreground/10 overflow-hidden flex items-center justify-center">
											<img
												src={f.thumbnailPath}
												alt={f.label}
												className="w-full h-full object-contain"
												draggable={false}
											/>
										</div>
										<span className="text-[8px] text-muted-foreground truncate w-full leading-tight">
											{f.label}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</section>
	);

	const effectSectionContent = (() => {
		const settingsSectionContent = (
			<div className="space-y-4">
				<section className="flex flex-col gap-2">
					<SectionLabel>{t("settings.appearance", "Giao diện")}</SectionLabel>
					<div className="grid grid-cols-3 gap-2">
						<button
							type="button"
							onClick={() => setPreference("light")}
							className={cn(
								"flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-medium transition-all duration-200 backdrop-blur-md",
								preference === "light"
									? "border-blue-500/80 bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.25)] font-semibold ring-1 ring-blue-500/30"
									: "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground hover:border-foreground/20",
							)}
						>
							<Sun className="h-4 w-4" weight={preference === "light" ? "fill" : "regular"} />
							<span className="text-[11px]">{t("settings.theme.light", "Sáng")}</span>
						</button>
						<button
							type="button"
							onClick={() => setPreference("dark")}
							className={cn(
								"flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-medium transition-all duration-200 backdrop-blur-md",
								preference === "dark"
									? "border-violet-500/80 bg-violet-500/15 text-violet-600 dark:text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.25)] font-semibold ring-1 ring-violet-500/30"
									: "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground hover:border-foreground/20",
							)}
						>
							<Moon className="h-4 w-4" weight={preference === "dark" ? "fill" : "regular"} />
							<span className="text-[11px]">{t("settings.theme.dark", "Tối")}</span>
						</button>
						<button
							type="button"
							onClick={() => setPreference("system")}
							className={cn(
								"flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-medium transition-all duration-200 backdrop-blur-md",
								preference === "system"
									? "border-indigo-500/80 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.25)] font-semibold ring-1 ring-indigo-500/30"
									: "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground hover:border-foreground/20",
							)}
						>
							<Desktop className="h-4 w-4" weight={preference === "system" ? "fill" : "regular"} />
							<span className="text-[11px]">{t("settings.theme.system", "Hệ thống")}</span>
						</button>
					</div>
				</section>

				<section className="flex flex-col gap-2">
					<SectionLabel>{t("common.app.language", "Language")}</SectionLabel>
					<Select value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
						<SelectTrigger className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{SUPPORTED_LOCALES.map((candidateLocale) => (
								<SelectItem key={candidateLocale} value={candidateLocale}>
									{APP_LANGUAGE_LABELS[candidateLocale]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</section>

				<section className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
						<div>
							<div className="text-[11px] font-medium text-foreground">
								{tSettings(
									"effects.autoApplyFreshRecordingZooms",
									"Auto-apply fresh recording zooms",
								)}
							</div>
							<div className="mt-0.5 text-[10px] text-muted-foreground/70">
								{tSettings(
									"effects.autoApplyFreshRecordingZoomsDescription",
									"Suggest cursor-follow zooms automatically when you open a new recording.",
								)}
							</div>
						</div>
						<Switch
							checked={autoApplyFreshRecordingAutoZooms}
							onCheckedChange={onAutoApplyFreshRecordingAutoZoomsChange}
							className="data-[state=checked]:bg-[#2563EB] scale-75"
						/>
					</div>
				</section>

				<section className="flex flex-col gap-2">
					<MotionPresetCards
						title={tSettings("effects.motionPresetsTitle", "Motion Presets")}
						activePresetId={activeMotionPresetId}
						onApply={applyMotionPreset}
						tSettings={tSettings}
					/>
				</section>

				<section className="flex flex-col gap-2">
					<SectionLabel>{t("editor.keyboardShortcuts.title")}</SectionLabel>
					<KeyboardShortcutsDialog
						triggerLabel={t("editor.keyboardShortcuts.customize")}
						triggerClassName="h-10 w-full justify-start rounded-xl border border-foreground/10 bg-foreground/5 px-3 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground"
					/>
				</section>

				{showDevMotionControls ? (
					<section className="flex flex-col gap-2 rounded-xl border border-[#2563EB]/15 bg-[#2563EB]/5 p-3">
						<div className="flex items-center justify-between gap-3">
							<div>
								<SectionLabel>
									{tSettings("effects.devSection", "Dev")}
								</SectionLabel>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.devSectionHint",
										"Temporary testing controls for native capture and motion tuning.",
									)}
								</div>
							</div>
							<span className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#2563EB]">
								DEV
							</span>
						</div>

						<div className="rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-[11px] font-medium text-foreground">
										{tSettings(
											"effects.nativeCaptureWarningTester",
											"Native capture warning",
										)}
									</div>
									<div className="mt-0.5 text-[10px] text-muted-foreground">
										{nativeCaptureUnavailableSession
											? tSettings(
													"effects.nativeCaptureWarningTesterUnavailable",
													"This project is currently marked as native capture unavailable.",
												)
											: tSettings(
													"effects.nativeCaptureWarningTesterAvailable",
													"This project is not marked as unsupported, but you can still open the modal for UI testing.",
												)}
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => onOpenNativeCaptureUnavailableModal?.()}
									className="h-8 shrink-0 border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/15"
								>
									{tSettings("effects.openNativeCaptureWarning", "Open warning")}
								</Button>
							</div>
						</div>

						<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div>
								<div className="text-[11px] font-medium text-foreground">
									{tSettings("effects.motionBlurDebug", "Motion Blur Debug")}
								</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.motionBlurDebugHint",
										"Development-only tuning for the split move-vs-zoom blur path. Pan controls drive the streak filter, and zoom controls drive the focus-centered zoom filter.",
									)}
								</div>
							</div>
							<SliderControl
								label={tSettings("effects.motionBlurPanThreshold", "Pan threshold")}
								value={zoomMotionBlurTuning.panVelocityThreshold}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.panVelocityThreshold
								}
								min={0}
								max={240}
								step={1}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										panVelocityThreshold: value,
									})
								}
								formatValue={(value) => `${Math.round(value)} px/s`}
								parseInput={(text) =>
									parseFloat(text.replace(/px\/s$/i, "").trim())
								}
							/>
							<SliderControl
								label={tSettings("effects.motionBlurPanStrength", "Pan max blur")}
								value={zoomMotionBlurTuning.maxDirectionalBlurPx}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.maxDirectionalBlurPx
								}
								min={0}
								max={96}
								step={0.1}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										maxDirectionalBlurPx: value,
									})
								}
								formatValue={(value) => `${value.toFixed(1)} px`}
								parseInput={(text) => parseFloat(text.replace(/px$/i, "").trim())}
							/>
							<SliderControl
								label={tSettings(
									"effects.motionBlurZoomThreshold",
									"Zoom threshold",
								)}
								value={zoomMotionBlurTuning.zoomVelocityThreshold}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.zoomVelocityThreshold
								}
								min={0}
								max={0.4}
								step={0.005}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										zoomVelocityThreshold: value,
									})
								}
								formatValue={(value) => value.toFixed(3)}
								parseInput={(text) => parseFloat(text)}
							/>
							<SliderControl
								label={tSettings(
									"effects.motionBlurZoomStrength",
									"Zoom blur strength",
								)}
								value={zoomMotionBlurTuning.maxRadialBlurStrength}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.maxRadialBlurStrength
								}
								min={0}
								max={1.5}
								step={0.005}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										maxRadialBlurStrength: value,
									})
								}
								formatValue={(value) => value.toFixed(3)}
								parseInput={(text) => parseFloat(text)}
							/>
						</div>

						<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div>
								<div className="text-[11px] font-medium text-foreground">
									{tSettings("effects.cameraDebugTuning", "Camera Debug Tuning")}
								</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.cameraDebugTuningHint",
										"Development-only spring tuning controls for camera motion.",
									)}
								</div>
							</div>
							<SliderControl
								label={tSettings(
									"effects.cameraSpringStiffnessMultiplier",
									"Camera stiffness",
								)}
								value={cameraSpringStiffnessMultiplier}
								defaultValue={
									initialEditorPreferences.cameraSpringStiffnessMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) =>
									onCameraSpringStiffnessMultiplierChange?.(value)
								}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cameraSpringDampingMultiplier",
									"Camera damping",
								)}
								value={cameraSpringDampingMultiplier}
								defaultValue={
									initialEditorPreferences.cameraSpringDampingMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCameraSpringDampingMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cameraSpringMassMultiplier",
									"Camera mass",
								)}
								value={cameraSpringMassMultiplier}
								defaultValue={initialEditorPreferences.cameraSpringMassMultiplier}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCameraSpringMassMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
						</div>

						<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div>
								<div className="text-[11px] font-medium text-foreground">
									{tSettings("effects.cursorDebugTuning", "Cursor Debug Tuning")}
								</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.cursorDebugTuningHint",
										"Development-only spring tuning controls.",
									)}
								</div>
							</div>
							<SliderControl
								label={tSettings(
									"effects.cursorSpringStiffnessMultiplier",
									"Spring stiffness",
								)}
								value={cursorSpringStiffnessMultiplier}
								defaultValue={
									initialEditorPreferences.cursorSpringStiffnessMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) =>
									onCursorSpringStiffnessMultiplierChange?.(value)
								}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cursorSpringDampingMultiplier",
									"Spring damping",
								)}
								value={cursorSpringDampingMultiplier}
								defaultValue={
									initialEditorPreferences.cursorSpringDampingMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCursorSpringDampingMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cursorSpringMassMultiplier",
									"Spring mass",
								)}
								value={cursorSpringMassMultiplier}
								defaultValue={initialEditorPreferences.cursorSpringMassMultiplier}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCursorSpringMassMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
						</div>
					</section>
				) : null}
			</div>
		);

		const sceneSectionContent = (
			<div className="space-y-4">
				{backgroundSettingsContent}
				{smartCameraSectionContent}
				{frameSectionContent}

				{renderExtensionPanelsForSections("scene", "appearance", "frame", "crop")}
			</div>
		);

		const zoomItemSectionContent = (
			<section className="flex flex-col gap-2">
				{selectedZoomId && (
					<>
						<div className="flex items-center justify-between gap-3">
							<SectionLabel>{tSettings("sections.zoom", "Zoom")}</SectionLabel>
						</div>
						<div className="flex rounded-lg border border-foreground/10 bg-foreground/5 p-0.5 mb-1">
							<button
								type="button"
								onClick={() => onZoomModeChange?.("auto")}
								className={cn(
									"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
									selectedZoomMode === "auto"
										? "bg-[#2563EB] text-white shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{tSettings("zoom.modeAuto", "Auto")}
							</button>
							<button
								type="button"
								onClick={() => onZoomModeChange?.("manual")}
								className={cn(
									"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
									selectedZoomMode === "manual"
										? "bg-[#2563EB] text-white shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{tSettings("zoom.modeManual", "Manual")}
							</button>
						</div>
						<div className="flex flex-col gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
							<div className="flex items-center justify-between">
								<span className="text-[11px] font-medium text-foreground">
									{tSettings("zoom.level", "Phóng to")}
								</span>
								<span className="text-[10px] font-semibold text-[#2563EB]">
									{
										ZOOM_DEPTH_OPTIONS.find(
											(o) => o.depth === selectedZoomDepth,
										)?.label
									}
								</span>
							</div>
							<div className="grid grid-cols-6 gap-1.5">
								{ZOOM_DEPTH_OPTIONS.map((option) => {
									const isActive = selectedZoomDepth === option.depth;
									return (
										<Button
											key={option.depth}
											type="button"
											onClick={() => onZoomDepthChange?.(option.depth)}
											className={cn(
												"h-7 w-full rounded-md border px-0 text-center shadow-none transition-all duration-150 cursor-pointer text-[11px] font-medium",
												isActive
													? "border-[#2563EB]/70 bg-[#2563EB] text-white"
													: "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground",
											)}
										>
											{option.label}
										</Button>
									);
								})}
							</div>
						</div>
					</>
				)}
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("zoom.globalSettings", "Animation")}</SectionLabel>
					<button
						type="button"
						onClick={resetZoomSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<div className="flex flex-col gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div className="flex items-center justify-between">
						<span className="text-[11px] font-medium text-foreground">
							{tSettings("effects.zoomSpeed", "Zoom speed")}
						</span>
						<span className="text-[10px] font-semibold text-[#2563EB]">
							{zoomSpeed}x
						</span>
					</div>
					<ToggleGroup
						type="single"
						value={String(zoomSpeed)}
						onValueChange={(value) => {
							if (value) {
								onZoomSpeedChange?.(normalizeZoomSpeed(Number(value)));
							}
						}}
						className="grid grid-cols-4 gap-1.5"
						aria-label={tSettings("effects.zoomSpeed", "Zoom speed")}
					>
						{ZOOM_SPEED_OPTIONS.map((speed) => (
							<ToggleGroupItem
								key={speed}
								value={String(speed)}
								aria-label={`${speed}x`}
								className={cn(
									"h-7 min-w-0 rounded-md border border-foreground/10 bg-foreground/[0.03] px-0 text-[11px] font-medium text-muted-foreground shadow-none transition-all hover:border-foreground/20 hover:bg-foreground/[0.06]",
									"data-[state=on]:border-[#2563EB]/70 data-[state=on]:bg-[#2563EB]/12 data-[state=on]:text-[#2563EB]",
								)}
							>
								{speed}x
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
				{selectedZoomId && (
					<Button
						onClick={() => {
							if (selectedZoomId && onZoomDelete) onZoomDelete(selectedZoomId);
						}}
						variant="destructive"
						size="sm"
						className="mt-1 h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("zoom.deleteZoom")}
					</Button>
				)}
				{renderExtensionPanelsForSections("zoom", "appearance", "frame", "crop")}
			</section>
		);

		const selectedAudioRegion = audioRegions.find((r) => r.id === selectedAudioId) ?? null;
		const canSplitAtPlayhead = Boolean(
			selectedAudioRegion &&
				typeof timelinePlayheadTimeMs === "number" &&
				timelinePlayheadTimeMs >= selectedAudioRegion.startMs + 100 &&
				timelinePlayheadTimeMs <= selectedAudioRegion.endMs - 100,
		);

		const maxFadeMs = selectedAudioRegion
			? Math.max(1000, Math.min(10000, selectedAudioRegion.endMs - selectedAudioRegion.startMs))
			: 10000;

		const formatTimeDisplay = (ms: number) => {
			const totalSec = Math.max(0, Math.floor(ms / 1000));
			const mins = Math.floor(totalSec / 60);
			const secs = totalSec % 60;
			const tenths = Math.floor((ms % 1000) / 100);
			return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${tenths}`;
		};

		const getAudioFileName = (path: string) => {
			if (!path) return "Audio";
			const parts = path.split(/[/\\]/);
			return parts[parts.length - 1] || "Audio";
		};

		const displayAudioRegions = audioRegions.filter((region, index, self) => {
			if (region.isDuplicate) return false;
			return self.findIndex((r) => r.audioPath === region.audioPath) === index;
		});

		const audioSectionContent = (
			<section className="flex flex-col gap-3.5">
				{/* Section Header */}
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-1.5">
						<MusicNotes className="h-4 w-4 text-violet-500" weight="duotone" />
						<SectionLabel>{tSettings("audio.bgmTitle", "Nhạc nền & Âm thanh")}</SectionLabel>
					</div>
					{selectedAudioId && (
						<button
							type="button"
							onClick={() => {
								onAudioVolumeChange?.(1);
								onAudioNormalizeChange?.(false);
								onAudioFadeInChange?.(0);
								onAudioFadeOutChange?.(0);
							}}
							className="text-[10px] text-violet-500 hover:text-violet-400 transition-opacity"
						>
							{t("common.actions.reset", "Reset")}
						</button>
					)}
				</div>

				{/* Add background music button */}
				{onAddAudio && (
					<Button
						type="button"
						variant="outline"
						onClick={onAddAudio}
						className="group relative flex w-full items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5 hover:bg-violet-500/10 text-xs font-medium text-foreground transition-all duration-200"
					>
						<Plus className="h-3.5 w-3.5 text-violet-500 transition-transform group-hover:scale-110" weight="bold" />
						<span>{tSettings("audio.addAudio", "Thêm file nhạc nền")}</span>
					</Button>
				)}

				{/* Track list / selector if multiple unique audio files exist */}
				{displayAudioRegions.length > 1 && (
					<div className="flex flex-col gap-1.5">
						<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
							{tSettings("audio.trackList", "Danh sách đoạn nhạc")} ({displayAudioRegions.length})
						</span>
						<div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5">
							{displayAudioRegions.map((region) => {
								const isSelected = region.id === selectedAudioId || selectedAudioRegion?.audioPath === region.audioPath;
								const fileName = getAudioFileName(region.audioPath);
								const durationSec = ((region.endMs - region.startMs) / 1000).toFixed(1);
								return (
									<button
										key={region.id}
										type="button"
										onClick={() => onSelectAudio?.(region.id)}
										className={cn(
											"flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all",
											isSelected
												? "bg-violet-500/15 border border-violet-500/40 text-violet-400 font-medium shadow-sm"
												: "bg-foreground/[0.03] hover:bg-foreground/[0.06] text-muted-foreground border border-transparent",
										)}
									>
										<div className="flex items-center gap-2 min-w-0">
											<Waveform className={cn("h-3.5 w-3.5 flex-shrink-0", isSelected ? "text-violet-400" : "text-muted-foreground/60")} />
											<span className="truncate text-[11px]">{fileName}</span>
										</div>
										<span className="text-[10px] text-muted-foreground/80 flex-shrink-0 font-mono">
											{durationSec}s
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* Controls for selected audio clip */}
				{selectedAudioRegion ? (
					<div className="flex flex-col gap-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] p-3">
						<div className="flex items-center justify-between border-b border-foreground/[0.06] pb-2">
							<div className="flex flex-col min-w-0">
								<span className="text-[11px] font-medium text-foreground truncate">
									{getAudioFileName(selectedAudioRegion.audioPath)}
								</span>
								<span className="text-[9px] text-muted-foreground font-mono">
									{formatTimeDisplay(selectedAudioRegion.startMs)} → {formatTimeDisplay(selectedAudioRegion.endMs)}
								</span>
							</div>
							<span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-400">
								Audio
							</span>
						</div>

						{/* Volume Slider */}
						<SliderControl
							label={tSettings("audio.volume", "Âm lượng")}
							value={selectedAudioVolume ?? 1}
							defaultValue={1}
							min={0}
							max={1}
							step={0.01}
							onChange={(v) => onAudioVolumeChange?.(v)}
							formatValue={(v) => `${Math.round(v * 100)}%`}
							parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
						/>

						{/* Fade In (Làm mịn đầu) */}
						<div className="flex flex-col gap-1.5">
							<SliderControl
								label={tSettings("audio.fadeIn", "Làm mịn đầu (Fade In)")}
								value={selectedAudioFadeInMs ?? 0}
								defaultValue={0}
								min={0}
								max={maxFadeMs}
								step={100}
								onChange={(v) => onAudioFadeInChange?.(v)}
								formatValue={(v) => `${(v / 1000).toFixed(1)}s`}
								parseInput={(text) => Math.round(parseFloat(text.replace(/s$/, "")) * 1000)}
							/>
							<div className="flex items-center gap-1">
								{[0, 500, 1000, 2000].map((presetMs) => (
									<button
										key={presetMs}
										type="button"
										onClick={() => onAudioFadeInChange?.(presetMs)}
										className={cn(
											"flex-1 py-0.5 text-[9px] rounded font-medium transition-all",
											(selectedAudioFadeInMs ?? 0) === presetMs
												? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
												: "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
										)}
									>
										{presetMs === 0 ? "0s" : `${(presetMs / 1000).toFixed(1)}s`}
									</button>
								))}
							</div>
						</div>

						{/* Fade Out (Làm mịn cuối) */}
						<div className="flex flex-col gap-1.5">
							<SliderControl
								label={tSettings("audio.fadeOut", "Làm mịn cuối (Fade Out)")}
								value={selectedAudioFadeOutMs ?? 0}
								defaultValue={0}
								min={0}
								max={maxFadeMs}
								step={100}
								onChange={(v) => onAudioFadeOutChange?.(v)}
								formatValue={(v) => `${(v / 1000).toFixed(1)}s`}
								parseInput={(text) => Math.round(parseFloat(text.replace(/s$/, "")) * 1000)}
							/>
							<div className="flex items-center gap-1">
								{[0, 500, 1000, 2000].map((presetMs) => (
									<button
										key={presetMs}
										type="button"
										onClick={() => onAudioFadeOutChange?.(presetMs)}
										className={cn(
											"flex-1 py-0.5 text-[9px] rounded font-medium transition-all",
											(selectedAudioFadeOutMs ?? 0) === presetMs
												? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
												: "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
										)}
									>
										{presetMs === 0 ? "0s" : `${(presetMs / 1000).toFixed(1)}s`}
									</button>
								))}
							</div>
						</div>

						{/* Split Audio (Cắt nhạc) */}
						<div className="flex flex-col gap-1.5 pt-1 border-t border-foreground/[0.06]">
							<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
								{tSettings("audio.splitSection", "Cắt nhạc (Split)")}
							</span>
							<Button
								type="button"
								variant="outline"
								disabled={!canSplitAtPlayhead}
								onClick={() => onAudioSplit?.(selectedAudioId)}
								className={cn(
									"h-8 w-full gap-2 text-xs font-medium transition-all",
									canSplitAtPlayhead
										? "border-violet-500/40 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/60"
										: "opacity-50 cursor-not-allowed",
								)}
							>
								<Scissors className="h-3.5 w-3.5" weight="bold" />
								{tSettings("audio.splitAudio", "Cắt nhạc tại con trỏ")}
							</Button>
							{typeof timelinePlayheadTimeMs === "number" && (
								<p className="text-[9px] text-muted-foreground text-center">
									{canSplitAtPlayhead ? (
										<span>
											Vị trí cắt: <span className="font-mono text-violet-400">{formatTimeDisplay(timelinePlayheadTimeMs)}</span>
										</span>
									) : (
										<span className="text-amber-500/80">
											{tSettings("audio.cannotSplitHere", "Di chuyển con trỏ phát vào bên trong đoạn nhạc để cắt")}
										</span>
									)}
								</p>
							)}
						</div>

						{/* Normalize Volume */}
						<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
							<span className="text-[10px] text-muted-foreground">
								{tSettings("audio.normalize", "Chuẩn hóa âm lượng")}
							</span>
							<Switch
								checked={Boolean(selectedAudioNormalize)}
								onCheckedChange={(v) => onAudioNormalizeChange?.(v)}
								className="data-[state=checked]:bg-violet-600 scale-75"
							/>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center p-4 text-center rounded-xl border border-foreground/[0.06] bg-foreground/[0.01]">
						<Waveform className="h-8 w-8 text-muted-foreground/40 mb-2" />
						<p className="text-xs font-medium text-muted-foreground">
							{audioRegions.length > 0
								? tSettings("audio.noAudioSelected", "Chưa chọn đoạn nhạc nào")
								: tSettings("audio.noAudioInProject", "Chưa có file nhạc nào trong dự án")}
						</p>
						<p className="text-[10px] text-muted-foreground/70 mt-1 max-w-[200px]">
							{tSettings(
								"audio.addAudioPrompt",
								"Kéo thả file âm thanh (MP3, WAV, AAC, M4A) hoặc bấm nút bên trên để thêm nhạc nền.",
							)}
						</p>
					</div>
				)}
			</section>
		);

		const annotationSectionContent = (
			<section className="flex flex-col gap-3.5">
				{/* Section Header */}
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-1.5">
						<TextT className="h-4 w-4 text-violet-500" weight="bold" />
						<SectionLabel>{tSettings("sections.annotation", "Chú thích")}</SectionLabel>
					</div>
				</div>

				{/* Add annotation button */}
				{onAddAnnotation && (
					<Button
						type="button"
						variant="outline"
						onClick={onAddAnnotation}
						className="group relative flex w-full items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5 hover:bg-violet-500/10 text-xs font-medium text-foreground transition-all duration-200 cursor-pointer"
					>
						<Plus className="h-3.5 w-3.5 text-violet-500 transition-transform group-hover:scale-110" weight="bold" />
						<span>{tSettings("annotation.addAnnotation", "Thêm chú thích")}</span>
					</Button>
				)}

				{/* Track list / selector if any annotation regions exist */}
				{annotationRegions.length > 0 && (
					<div className="flex flex-col gap-1.5">
						<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
							{tSettings("annotation.list", "Danh sách chú thích")} ({annotationRegions.length})
						</span>
						<div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
							{annotationRegions.map((region, idx) => {
								const isSelected = region.id === selectedAnnotationId;
								const label = region.textContent || region.content || `${region.type} #${idx + 1}`;
								const durationSec = ((region.endMs - region.startMs) / 1000).toFixed(1);
								return (
									<button
										key={region.id}
										type="button"
										onClick={() => onSelectAnnotation?.(region.id)}
										className={cn(
											"flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer",
											isSelected
												? "bg-violet-500/15 border border-violet-500/40 text-violet-400 font-medium shadow-sm"
												: "bg-foreground/[0.03] hover:bg-foreground/[0.06] text-muted-foreground border border-transparent",
										)}
									>
										<div className="flex items-center gap-2 min-w-0">
											<TextT className={cn("h-3.5 w-3.5 flex-shrink-0", isSelected ? "text-violet-400" : "text-muted-foreground/60")} weight="bold" />
											<span className="truncate text-[11px]">{label}</span>
										</div>
										<span className="text-[10px] text-muted-foreground/80 flex-shrink-0 font-mono">
											{durationSec}s
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* Empty state if no annotations in project */}
				{annotationRegions.length === 0 && (
					<div className="flex flex-col items-center justify-center p-4 text-center rounded-xl border border-foreground/[0.06] bg-foreground/[0.01]">
						<TextT className="h-8 w-8 text-muted-foreground/40 mb-2" weight="duotone" />
						<p className="text-xs font-medium text-muted-foreground">
							{tSettings("annotation.noAnnotations", "Chưa có chú thích nào trong dự án")}
						</p>
						<p className="text-[10px] text-muted-foreground/70 mt-1 max-w-[200px]">
							{tSettings(
								"annotation.addPrompt",
								"Bấm nút bên trên hoặc nhấn phím 'A' để thêm văn bản, hình khối, mũi tên hoặc làm mờ.",
							)}
						</p>
					</div>
				)}
			</section>
		);

		const clipSectionContent = (
			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("clip.title", "Clip")}</SectionLabel>
					{selectedClipSpeed != null && selectedClipSpeed !== 1 && (
						<span className="rounded-full bg-[#06b6d4]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#06b6d4]">
							{selectedClipSpeed}×
						</span>
					)}
				</div>

				<div className="flex items-center gap-3">
					<SectionLabel>{tSettings("speed.label", "Speed")}</SectionLabel>
				</div>
				<div className="grid grid-cols-4 gap-1.5">
					{[
						{ speed: 0.25, label: "0.25×" },
						{ speed: 0.5, label: "0.5×" },
						{ speed: 0.75, label: "0.75×" },
						{ speed: 1, label: "1×" },
						{ speed: 1.25, label: "1.25×" },
						{ speed: 1.5, label: "1.5×" },
						{ speed: 2, label: "2×" },
						{ speed: 2.5, label: "2.5×" },
						{ speed: 3, label: "3×" },
						{ speed: 4, label: "4×" },
						{ speed: 5, label: "5×" },
						{ speed: 8, label: "8×" },
						{ speed: 10, label: "10×" },
						{ speed: 15, label: "15×" },
						{ speed: 20, label: "20×" },
						{ speed: 30, label: "30×" },
					].map((option) => {
						const isActive = selectedClipSpeed === option.speed;
						return (
							<Button
								key={option.speed}
								type="button"
								onClick={() => onClipSpeedChange?.(option.speed)}
								className={cn(
									"h-auto w-full rounded-lg border px-0.5 py-2 text-center shadow-sm transition-all duration-200 ease-out cursor-pointer",
									isActive
										? "border-[#06b6d4] bg-[#06b6d4] text-white"
										: "border-foreground/5 bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:border-foreground/10 hover:text-foreground",
								)}
							>
								<span className="text-[10px] font-semibold">{option.label}</span>
							</Button>
						);
					})}
				</div>

				<div className="mt-2 flex flex-col gap-2 border-t border-foreground/5 pt-3">
					<SectionLabel>{tSettings("audio.title", "Audio")}</SectionLabel>

					<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
						<div>
							<span className="text-[10px] text-muted-foreground">
								{tSettings("clip.mute", "Mute")}
							</span>
							<p className="text-[9px] text-muted-foreground/50 mt-0.5">
								{selectedClipMuted
									? tSettings("clip.mutedState", "Audio is muted")
									: tSettings("clip.unmutedState", "Audio is playing")}
							</p>
						</div>
						<Switch
							checked={selectedClipMuted ?? false}
							onCheckedChange={(v) => onClipMutedChange?.(v)}
							className="data-[state=checked]:bg-[#06b6d4] scale-75"
						/>
					</div>
					{hasClipSourceAudio && (
						<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
							<span className="text-[10px] text-muted-foreground">
								{tSettings(
									"clip.separateClipFromAudio",
									"Separate clip from audio",
								)}
							</span>
							<Switch
								checked={selectedClipShowSourceAudio ?? false}
								onCheckedChange={(v) => onClipShowSourceAudioChange?.(v)}
								className="data-[state=checked]:bg-[#06b6d4] scale-75"
							/>
						</div>
					)}
				</div>

				{selectedClipId && hasClipSourceAudio && sourceAudioTrackMeta.length > 0 && (
					<div className="mt-1 flex flex-col gap-3">
						{sourceAudioTrackMeta.map((track) => {
							const settings = sourceAudioTrackSettings[track.id] ?? {
								volume: 1,
								normalize: false,
							};
							return (
								<div
									key={track.id}
									className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2"
								>
									<div className="mb-2 flex items-center justify-between">
										<span className="text-[11px] font-medium text-foreground">
											{track.label}
										</span>
										<button
											type="button"
											onClick={() => {
												onSourceAudioTrackVolumeChange?.(track.id, 1);
												onSourceAudioTrackNormalizeChange?.(
													track.id,
													false,
												);
											}}
											className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
										>
											{t("common.actions.reset", "Reset")}
										</button>
									</div>
									<div className="mb-2 flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
										<span className="text-[10px] text-muted-foreground">
											{tSettings("audio.normalize", "Normalize")}
										</span>
										<Switch
											checked={settings.normalize}
											onCheckedChange={(v) =>
												onSourceAudioTrackNormalizeChange?.(track.id, v)
											}
											className="data-[state=checked]:bg-[#06b6d4] scale-75"
										/>
									</div>
									<SliderControl
										label={tSettings("audio.volume", "Volume")}
										value={settings.volume}
										defaultValue={1}
										min={0}
										max={1}
										step={0.01}
										onChange={(v) =>
											onSourceAudioTrackVolumeChange?.(track.id, v)
										}
										formatValue={(v) => `${Math.round(v * 100)}%`}
										parseInput={(text) =>
											parseFloat(text.replace(/%$/, "")) / 100
										}
									/>
								</div>
							);
						})}
					</div>
				)}
			</section>
		);

		switch (activeEffectSection) {
			case "settings":
				return settingsSectionContent;
			case "scene":
				return sceneSectionContent;
			case "zoom":
				return zoomItemSectionContent;
			case "clip":
				return clipSectionContent;
			case "audio":
				return audioSectionContent;
			case "annotation":
				return annotationSectionContent;
			case "frame":
				return sceneSectionContent;
			case "crop":
				return sceneSectionContent;
			case "cursor":
				return (
					<section className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<SectionLabel>
									{tSettings("sections.cursor", "Cursor")}
								</SectionLabel>
								<button
									type="button"
									onClick={resetCursorSection}
									className="text-[10px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
								>
									{t("common.actions.reset", "Reset")}
								</button>
							</div>
							<label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground cursor-pointer">
								<span>{tSettings("effects.showCursor")}</span>
								<Switch
									checked={showCursor}
									onCheckedChange={onShowCursorChange}
									className="data-[state=checked]:bg-blue-600 scale-75"
								/>
							</label>
						</div>
						<div className="flex flex-col gap-1.5">
							<div className="space-y-1.5">
								<ToggleGroup
									type="single"
									value={cursorStyle}
									onValueChange={(value) => {
										if (value) {
											onCursorStyleChange?.(value as CursorStyle);
										}
									}}
									className="grid grid-cols-3 gap-2"
									aria-label={tSettings("effects.cursorStyle", "Cursor Style")}
								>
									{cursorStyleOptions.map((option) => (
										<ToggleGroupItem
											key={option.value}
											value={option.value}
											title={option.label}
											aria-label={option.label}
											className={cn(
												"group h-auto min-w-0 rounded-[10px] border border-foreground/10 bg-foreground/[0.03] px-2 py-2 text-left text-foreground shadow-none transition-all hover:border-foreground/20 hover:bg-foreground/[0.06]",
												"data-[state=on]:border-[#2563EB]/70 data-[state=on]:bg-[#2563EB]/12 data-[state=on]:text-foreground",
											)}
										>
											<div className="flex flex-col items-center gap-1.5">
												<div className="flex h-9 items-center justify-center">
													<CursorStylePreview
														style={option.value}
														previewUrls={cursorPreviewUrls}
													/>
												</div>
												<span className="text-center text-[9px] leading-tight text-muted-foreground group-data-[state=on]:text-[#2563EB]">
													{option.label}
												</span>
											</div>
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</div>
							<SliderControl
								label={tSettings("effects.cursorSize")}
								value={cursorSize}
								defaultValue={DEFAULT_CURSOR_SIZE}
								min={0.5}
								max={10}
								step={0.05}
								onChange={(v) => onCursorSizeChange?.(v)}
								formatValue={(v) => `${v.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.cursorMotionBlur")}
								value={cursorMotionBlur}
								defaultValue={DEFAULT_CURSOR_MOTION_BLUR}
								min={0}
								max={2}
								step={0.05}
								onChange={(v) => onCursorMotionBlurChange?.(v)}
								formatValue={(v) => `${v.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.cursorClickBounce")}
								value={cursorClickBounce}
								defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE}
								min={0}
								max={5}
								step={0.05}
								onChange={(v) => onCursorClickBounceChange?.(v)}
								formatValue={(v) => `${v.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cursorClickBounceDuration",
									"Bounce Speed",
								)}
								value={cursorClickBounceDuration}
								defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE_DURATION}
								min={60}
								max={500}
								step={5}
								onChange={(v) => onCursorClickBounceDurationChange?.(v)}
								formatValue={(v) => `${Math.round(v)} ms`}
								parseInput={(text) => parseFloat(text.replace(/ms$/i, "").trim())}
							/>
							<SliderControl
								label={tSettings("effects.cursorSway")}
								value={toCursorSwaySliderValue(cursorSway)}
								defaultValue={toCursorSwaySliderValue(DEFAULT_CURSOR_SWAY)}
								min={0}
								max={toCursorSwaySliderValue(2)}
								step={toCursorSwaySliderValue(0.05)}
								onChange={(v) => onCursorSwayChange?.(fromCursorSwaySliderValue(v))}
								formatValue={(v) =>
									v <= 0 ? tSettings("effects.off") : `${v.toFixed(2)}×`
								}
								parseInput={(text) => {
									const normalized = text.trim().toLowerCase();
									if (normalized === "off") return 0;
									return parseFloat(text.replace(/×$/, ""));
								}}
							/>
							{showDevMotionControls ? (
								<div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2">
									<div className="text-[10px] text-muted-foreground">
										{tSettings(
											"effects.cursorDebugMovedToDev",
											"Cursor spring tuning is available in Settings > Dev.",
										)}
									</div>
								</div>
							) : null}
						</div>

						{/* ── Click Effect sub-section ── */}
						<div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5">
							<div className="flex items-center justify-between">
								<span className="text-[11px] font-medium text-foreground/80">
									{"Hiệu ứng click chuột"}
								</span>
								<Switch
									checked={showClickEffect}
									onCheckedChange={(v) => onShowClickEffectChange?.(v)}
									className="data-[state=checked]:bg-[#2563EB] scale-75"
								/>
							</div>
							{showClickEffect && (
								<div className="flex flex-col gap-2">
									{/* Style picker */}
									<div className="grid grid-cols-4 gap-1.5">
										{(
											[
												{ value: "ring", label: "Vòng tròn", icon: "○" },
												{
													value: "spotlight",
													label: "Đèn chiếu",
													icon: "◎",
												},
												{ value: "bloom", label: "Hào quang", icon: "☼" },
												{ value: "magnetic", label: "Từ trường", icon: "⟐" },
											] as const
										).map((style) => (
											<button
												key={style.value}
												type="button"
												onClick={() =>
													onClickEffectStyleChange?.(style.value)
												}
												className={cn(
													"flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-1 text-[10px] font-medium transition-all cursor-pointer",
													(clickEffectStyle === style.value || (!["ring", "spotlight", "bloom", "magnetic"].includes(clickEffectStyle) && style.value === "ring"))
														? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
														: "border-foreground/10 bg-foreground/[0.02] text-muted-foreground hover:border-foreground/20 hover:text-foreground",
												)}
											>
												<span className="text-[16px] leading-none">
													{style.icon}
												</span>
												<span className="truncate max-w-full">{style.label}</span>
											</button>
										))}
									</div>
									{/* Size slider */}
									<SliderControl
										label={"Kích thước"}
										value={clickEffectSize}
										defaultValue={1}
										min={0.3}
										max={3}
										step={0.05}
										onChange={(v) => onClickEffectSizeChange?.(v)}
										formatValue={(v) => `${v.toFixed(2)}×`}
										parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
									/>
									{/* Sound toggle & options */}
									<div className="flex flex-col gap-2 rounded-lg bg-foreground/[0.03] p-2">
										<label className="flex items-center justify-between text-[11px] font-medium text-foreground cursor-pointer">
											<span>{"Âm thanh khi click chuột"}</span>
											<Switch
												checked={clickSound}
												onCheckedChange={(v) => onClickSoundChange?.(v)}
												className="data-[state=checked]:bg-[#2563EB] scale-75"
											/>
										</label>
										{clickSound && (
											<div className="flex flex-col gap-2 pt-1.5 border-t border-foreground/5">
												<div className="flex flex-col gap-1">
													<span className="text-[10px] text-muted-foreground">
														{"Kiểu âm thanh"}
													</span>
													<div className="grid grid-cols-2 gap-1.5">
														{CLICK_SOUND_STYLES.map((style) => (
															<button
																key={style.id}
																type="button"
																onClick={() => {
																	onClickSoundStyleChange?.(
																		style.id,
																	);
																	playClickSound(
																		style.id,
																		clickSoundVolume,
																	);
																}}
																className={cn(
																	"flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
																	clickSoundStyle === style.id
																		? "bg-[#2563EB]/15 border-[#2563EB]/60 text-[#2563EB] dark:text-white"
																		: "bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
																)}
																title={style.description}
															>
																<span>{style.label}</span>
																<Volume2 className="h-3 w-3 opacity-60" />
															</button>
														))}
													</div>
												</div>
												<SliderControl
													label={"Âm lượng click"}
													value={clickSoundVolume}
													defaultValue={0.7}
													min={0.1}
													max={1}
													step={0.05}
													onChange={(v) => onClickSoundVolumeChange?.(v)}
													formatValue={(v) => `${Math.round(v * 100)}%`}
													parseInput={(text) =>
														parseFloat(text.replace(/%$/, "")) / 100
													}
												/>
											</div>
										)}
									</div>
								</div>
							)}
						</div>

						{renderExtensionPanelsForSections("cursor")}
					</section>
				);
			case "webcam":
				return (
					<section className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<SectionLabel>{tSettings("sections.webcam", "Webcam")}</SectionLabel>
							<button
								type="button"
								onClick={resetWebcamSection}
								className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
							>
								{t("common.actions.reset", "Reset")}
							</button>
						</div>
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
								<span className="text-[10px] text-muted-foreground">
									{tSettings("effects.show", "Show")}
								</span>
								<Switch
									checked={webcam?.enabled ?? false}
									onCheckedChange={(enabled) => updateWebcam({ enabled })}
									className="data-[state=checked]:bg-[#2563EB] scale-75"
								/>
							</div>
							{webcam?.enabled && !webcam?.sourcePath && (
								<div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
									<div className="flex items-center gap-1.5 font-semibold text-[11px]">
										<span>⚠️</span>
										<span>{tSettings("effects.webcamNoFootageNoticeTitle", "Chưa có video camera khi quay")}</span>
									</div>
									<p className="mt-1 text-[10.5px] leading-relaxed text-amber-700/80 dark:text-amber-300/80">
										{tSettings(
											"effects.webcamNoFootageNoticeDesc",
											"Hiện đang lấy hình màn hình làm mẫu để bạn căn chỉnh khung/vị trí. Để có hình ảnh khuôn mặt thật: hãy bật Camera trên thanh ghi hình trước khi bấm REC, hoặc tải video webcam lên ở mục bên dưới.",
										)}
									</p>
								</div>
							)}
							<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
								<span className="text-[10px] text-muted-foreground">
									{tSettings("effects.webcamReactToZoom")}
								</span>
								<Switch
									checked={webcam?.reactToZoom ?? DEFAULT_WEBCAM_REACT_TO_ZOOM}
									onCheckedChange={(reactToZoom) => updateWebcam({ reactToZoom })}
									className="data-[state=checked]:bg-[#2563EB] scale-75"
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
								<span className="text-[10px] text-muted-foreground">
									{tSettings("effects.webcamMirror", "Mirror webcam")}
								</span>
								<Switch
									checked={webcam?.mirror ?? true}
									onCheckedChange={(mirror) => updateWebcam({ mirror })}
									className="data-[state=checked]:bg-[#2563EB] scale-75"
								/>
							</div>
							<SliderControl
								label={tSettings("effects.webcamSize")}
								value={webcam?.size ?? DEFAULT_WEBCAM_SIZE}
								defaultValue={DEFAULT_WEBCAM_SIZE}
								min={10}
								max={100}
								step={1}
								onChange={(v) => updateWebcam({ size: v })}
								formatValue={(v) => `${Math.round(v)}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<div className="rounded-lg bg-foreground/[0.03] px-2.5 py-2">
								<div className="mb-2 flex items-center justify-between gap-2">
									<div className="text-[10px] text-muted-foreground">
										{tSettings("effects.webcamCrop", "Crop")}
									</div>
									<button
										type="button"
										onClick={() =>
											updateWebcam({ cropRegion: DEFAULT_CROP_REGION })
										}
										className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
									>
										{t("common.actions.reset", "Reset")}
									</button>
								</div>
								<WebcamCropControl
									cropRegion={webcamCrop}
									mirrored={webcam?.mirror ?? true}
									previewSrc={webcamPreviewSrc}
									previewCurrentTime={webcamPreviewCurrentTime}
									previewPlaying={webcamPreviewPlaying}
									previewTimeOffsetMs={webcam?.timeOffsetMs}
									onCropChange={(cropRegion) => updateWebcam({ cropRegion })}
								/>
							</div>
							<div className="rounded-lg bg-foreground/[0.03] px-2.5 py-2">
								<div className="mb-2 text-[10px] text-muted-foreground">
									{tSettings("effects.webcamPosition", "Position")}
								</div>
								<div className="grid grid-cols-3 gap-1.5">
									{WEBCAM_POSITION_PRESETS.map((option) => {
										const isActive = webcamPositionPreset === option.preset;
										return (
											<Button
												key={option.preset}
												type="button"
												onClick={() =>
													applyWebcamPositionPreset(option.preset)
												}
												className={cn(
													"h-8 rounded-lg border px-0 text-sm font-semibold transition-all",
													isActive
														? "border-[#2563EB] bg-[#2563EB] text-white"
														: "border-foreground/10 bg-foreground/5 text-muted-foreground hover:border-foreground/20 hover:bg-foreground/10",
												)}
											>
												{option.label}
											</Button>
										);
									})}
								</div>
								<div className="mt-2 flex items-center justify-between rounded-lg bg-black/10 px-2.5 py-1.5">
									<span className="text-[10px] text-muted-foreground">
										{tSettings(
											"effects.webcamCustomPosition",
											"Custom position",
										)}
									</span>
									<Switch
										checked={webcamPositionPreset === "custom"}
										onCheckedChange={(checked) =>
											applyWebcamPositionPreset(
												checked ? "custom" : DEFAULT_WEBCAM_POSITION_PRESET,
											)
										}
										className="data-[state=checked]:bg-[#2563EB] scale-75"
									/>
								</div>
							</div>
							{webcamPositionPreset === "custom" ? (
								<>
									<SliderControl
										label={tSettings("effects.webcamHorizontal", "Horizontal")}
										value={webcamPositionX * 100}
										defaultValue={DEFAULT_WEBCAM_POSITION_X * 100}
										min={0}
										max={100}
										step={1}
										onChange={(v) =>
											updateWebcam({
												positionPreset: "custom",
												positionX: v / 100,
											})
										}
										formatValue={(v) => `${Math.round(v)}%`}
										parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
									/>
									<SliderControl
										label={tSettings("effects.webcamVertical", "Vertical")}
										value={webcamPositionY * 100}
										defaultValue={DEFAULT_WEBCAM_POSITION_Y * 100}
										min={0}
										max={100}
										step={1}
										onChange={(v) =>
											updateWebcam({
												positionPreset: "custom",
												positionY: v / 100,
											})
										}
										formatValue={(v) => `${Math.round(v)}%`}
										parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
									/>
								</>
							) : null}
							<SliderControl
								label={tSettings("effects.webcamMargin", "Margin")}
								value={webcam?.margin ?? DEFAULT_WEBCAM_MARGIN}
								defaultValue={DEFAULT_WEBCAM_MARGIN}
								min={0}
								max={96}
								step={1}
								onChange={(v) => updateWebcam({ margin: v })}
								formatValue={(v) => `${Math.round(v)}px`}
								parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.webcamRoundness")}
								value={webcam?.cornerRadius ?? DEFAULT_WEBCAM_CORNER_RADIUS}
								defaultValue={DEFAULT_WEBCAM_CORNER_RADIUS}
								min={0}
								max={160}
								step={1}
								onChange={(v) => updateWebcam({ cornerRadius: v })}
								formatValue={(v) => `${Math.round(v)}px`}
								parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.webcamShadow")}
								value={webcam?.shadow ?? DEFAULT_WEBCAM_SHADOW}
								defaultValue={DEFAULT_WEBCAM_SHADOW}
								min={0}
								max={1}
								step={0.01}
								onChange={(v) => updateWebcam({ shadow: v })}
								formatValue={(v) => `${Math.round(v * 100)}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
							/>
							<div className="mt-1 rounded-2xl border border-foreground/10 bg-foreground/[0.02] dark:bg-white/[0.02] p-3.5 shadow-sm transition-all hover:border-foreground/15">
								<div className="flex flex-col gap-3">
									<div className="flex items-start gap-3">
										<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 shadow-sm">
											<VideoCamera className="h-4.5 w-4.5" weight="duotone" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="text-xs font-semibold text-foreground tracking-tight">
												{tSettings("effects.webcamFootage")}
											</div>
											<div className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground/80">
												{webcamFileName ??
													tSettings("effects.webcamFootageDescription")}
											</div>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<Button
											type="button"
											onClick={onRecordWebcam}
											className="h-8 min-w-0 gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm active:scale-[0.98] transition-all"
										>
											<Record className="h-3.5 w-3.5" weight="fill" />
											<span className="min-w-0 truncate">
												{tSettings("effects.recordWebcamDirect", "Quay trực tiếp")}
											</span>
										</Button>

										<Button
											type="button"
											variant="outline"
											onClick={onUploadWebcam}
											className={cn(
												"h-8 min-w-0 gap-1.5 rounded-lg border-foreground/15 bg-background text-xs font-medium text-foreground shadow-sm hover:bg-foreground/5 hover:text-foreground active:scale-[0.98] transition-all",
												!webcam?.sourcePath && "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/15 hover:border-violet-500/40 font-semibold",
											)}
										>
											<Upload className="h-3.5 w-3.5" />
											<span className="min-w-0 truncate">
												{webcam?.sourcePath
													? tSettings("effects.replaceWebcamFootage")
													: tSettings("effects.uploadWebcamFootage")}
											</span>
										</Button>
									</div>
									{webcam?.sourcePath ? (
										<Button
											type="button"
											variant="outline"
											onClick={onClearWebcam}
											className="h-7 w-full gap-1.5 rounded-lg border-destructive/20 bg-destructive/5 text-xs font-medium text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive active:scale-[0.98] transition-all"
										>
											<Trash2 className="h-3.5 w-3.5" />
											<span className="min-w-0 truncate">
												{tSettings("effects.removeWebcamFootage")}
											</span>
										</Button>
									) : null}
								</div>
							</div>
							{renderExtensionPanelsForSections("webcam")}
						</div>
					</section>
				);
			default: {
				// Handle extension-contributed standalone section pages (ext:extensionId/panelId)
				if (activeEffectSection?.startsWith("ext:")) {
					const panels = extensionPanels.filter(
						(p) =>
							!p.panel.parentSection &&
							`ext:${p.extensionId}/${p.panel.id}` === activeEffectSection,
					);
					if (panels.length > 0) {
						const p = panels[0];
						return (
							<section className="flex flex-col gap-2">
								<SectionLabel>{p.panel.label}</SectionLabel>
								<ExtensionSettingsSection
									extensionId={p.extensionId}
									label={p.panel.label}
									fields={p.panel.fields}
								/>
							</section>
						);
					}
				}
				return sceneSectionContent;
			}
		}
	})();

	return (
		<div className="flex-[2] w-[332px] min-w-[280px] max-w-[332px] bg-white/75 dark:bg-[#120d26]/85 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.12] rounded-[24px] flex flex-col shadow-[0_16px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_0_35px_rgba(124,58,237,0.12)] text-slate-800 dark:text-white h-full overflow-hidden transition-colors duration-300">
			<div
				className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-8"
				style={{ scrollbarGutter: "stable" }}
			>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={activeEffectSection}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
					>
						{effectSectionContent}
					</motion.div>
				</AnimatePresence>
			</div>

			<div
				className={cn(
					"flex-shrink-0 border-t border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-[#120d26]/90 p-4 pt-3 transition-colors duration-300",
					(() => {
						if (activeEffectSection === "clip" && selectedClipId) return false;
						if (activeEffectSection === "zoom" && selectedZoomId) return false;
						if (activeEffectSection === "audio" && selectedAudioId) return false;
						if (selectedAnnotationId) return false; // Annotation editor handles its own but let's see
						return true;
					})() && "hidden",
				)}
			>
				{activeEffectSection === "clip" && selectedClipId && (
					<Button
						onClick={() => {
							if (selectedClipId && onClipDelete) onClipDelete(selectedClipId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("clip.delete", "Delete Clip")}
					</Button>
				)}
				{activeEffectSection === "zoom" && selectedZoomId && (
					<Button
						onClick={() => {
							if (selectedZoomId && onZoomDelete) onZoomDelete(selectedZoomId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("zoom.deleteZoom", "Delete Zoom")}
					</Button>
				)}
				{activeEffectSection === "audio" && selectedAudioId && (
					<Button
						onClick={() => {
							if (selectedAudioId && onAudioDelete) onAudioDelete(selectedAudioId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("audio.deleteRegion", "Delete Audio")}
					</Button>
				)}
				{selectedAnnotationId && (
					<Button
						onClick={() => {
							if (selectedAnnotationId && onAnnotationDelete)
								onAnnotationDelete(selectedAnnotationId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("annotation.delete", "Delete Annotation")}
					</Button>
				)}
			</div>
		</div>
	);
}

export default memo(SettingsPanel);

