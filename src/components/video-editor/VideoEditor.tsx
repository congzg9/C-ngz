import {
	Check,
	CaretDown as ChevronDown,
	CaretUp as ChevronUp,
	Crop,
	Crown,
	Cursor,
	DownloadSimple as Download,
	FolderOpen,
	GearSix,
	MusicNotes,
	Palette,
	Pause,
	Play,
	PuzzlePiece,
	ArrowClockwise as Redo2,
	SkipBack,
	SkipForward,
	TextT,
	ArrowCounterClockwise as Undo2,
	UploadSimple as Upload,
	VideoCamera,
	SpeakerLow as Volume1,
	SpeakerHigh as Volume2,
	SpeakerX as VolumeX,
	MagicWand as WandSparkles,
	X,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LicenseModal } from "@/components/license/LicenseModal";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { useI18n } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	calculateOutputDimensions,
	DEFAULT_MP4_CODEC,
	type ExportBackendPreference,
	type ExportEncodingMode,
	type ExportFormat,
	type ExportMp4FrameRate,
	type ExportPipelineModel,
	type ExportProgress,
	type ExportQuality,
	type ExportSettings,
	FrameRenderer,
	GIF_SIZE_PRESETS,
	GifExporter,
	type GifFrameRate,
	type GifSizePreset,
	ModernVideoExporter,
	probeSupportedMp4Dimensions,
	type SupportedMp4Dimensions,
	VideoExporter,
} from "@/lib/exporter";
import { getMp4ExportBitrate, getSourceQualityBitrate } from "@/lib/exporter/exportBitrate";
import {
	canUseInMemoryExportSaveFallback,
	describeBlockedInMemoryExportSave,
} from "@/lib/exporter/exportSavePolicy";
import { matchesShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import {
	ASPECT_RATIOS,
	type AspectRatio,
	getAspectRatioLabel,
	getAspectRatioValue,
} from "@/utils/aspectRatioUtils";
import { type ClickSoundStyle } from "./audio/clickSoundGenerator";
import { ExtensionIcon } from "./ExtensionIcon";
import { calculateMp4ExportDimensions, calculateMp4SourceDimensions } from "./exportDimensions";

const PhCursorFill = (props: { className?: string; weight?: "fill" | "regular" | "duotone" }) => (
	<Cursor weight={props.weight ?? "fill"} className={props.className} />
);
const PhCamera = (props: { className?: string; weight?: "fill" | "regular" | "duotone" }) => (
	<VideoCamera weight={props.weight ?? "regular"} className={props.className} />
);
const PhPuzzle = (props: { className?: string; weight?: "fill" | "regular" | "duotone" }) => (
	<PuzzlePiece weight={props.weight ?? "regular"} className={props.className} />
);
const PhPalette = (props: { className?: string; weight?: "fill" | "regular" | "duotone" }) => (
	<Palette weight={props.weight ?? "duotone"} className={props.className} />
);
const PhSettings = (props: { className?: string; weight?: "fill" | "regular" | "duotone" }) => (
	<GearSix weight={props.weight ?? "regular"} className={props.className} />
);
const PhAudio = (props: { className?: string; weight?: "fill" | "regular" | "duotone" }) => (
	<MusicNotes weight={props.weight ?? "regular"} className={props.className} />
);
const PhAnnotation = (props: { className?: string; weight?: "fill" | "regular" | "duotone" }) => (
	<TextT weight={props.weight ?? "bold"} className={props.className} />
);

const UNIFIED_RAIL_THEME = {
	activeClass:
		"bg-gradient-to-b from-violet-600 to-indigo-700 text-white shadow-[0_4px_16px_rgba(109,40,217,0.35)] border-t border-white/30 ring-1 ring-violet-500/40",
	inactiveClass:
		"text-foreground/60 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/20 border border-transparent",
	dotClass:
		"bg-gradient-to-b from-violet-400 to-indigo-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]",
};

const SECTION_THEMES: Record<
	string,
	{
		activeClass: string;
		inactiveClass: string;
		dotClass: string;
	}
> = {
	scene: UNIFIED_RAIL_THEME,
	cursor: UNIFIED_RAIL_THEME,
	webcam: UNIFIED_RAIL_THEME,
	settings: UNIFIED_RAIL_THEME,
	audio: UNIFIED_RAIL_THEME,
	annotation: UNIFIED_RAIL_THEME,
};

import type { SourceAudioTrackSettings } from "@/components/video-editor/audio/audioTypes";
import { extensionHost } from "@/lib/extensions";
import { useVideoEditorAudio } from "./audio/useVideoEditorAudio";
import { CropControl } from "./CropControl";
import { ExportSettingsMenu } from "./ExportSettingsMenu";
import {
	loadEditorPreferences,
	saveEditorPreferences,
} from "./editorPreferences";
import ProjectBrowserDialog, { type ProjectLibraryEntry } from "./ProjectBrowserDialog";
import { RecordWebcamDialog } from "./RecordWebcamDialog";
import {
	createProjectData,
	deriveNextId,
	type EditorProjectData,
	fromFileUrl,
	normalizeProjectEditor,
	resolveVideoUrl,
	stripPersistedDevMotionBlurSettings,
	toFileUrl,
	validateProjectData,
} from "./projectPersistence";
import { SettingsPanel } from "./SettingsPanel";
import {
	APP_HEADER_ICON_BUTTON_CLASS,
	openExternalLink,
	RECORDLY_ISSUES_URL,
} from "./TutorialHelp";
import TimelineEditor, { type TimelineEditorHandle } from "./timeline/TimelineEditor";
import {
	buildInteractionZoomSuggestions,
	normalizeCursorTelemetry,
	resolveZoomFocusForSpan,
} from "./timeline/zoomSuggestionUtils";
import {
	type AnnotationRegion,
	type AudioRegion,
	type ClipRegion,
	type CropRegion,
	type CursorStyle,
	type CursorTelemetryPoint,
	clampFocusToDepth,
	clipsToTrims,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_AUTO_ZOOM_DEPTH,
	DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	DEFAULT_CONNECTED_ZOOM_EASING,
	DEFAULT_CONNECTED_ZOOM_GAP_MS,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_FIGURE_DATA,
	DEFAULT_WEBCAM_OVERLAY,
	DEFAULT_WEBCAM_TIME_OFFSET_MS,
	DEFAULT_ZOOM_IN_DURATION_MS,
	DEFAULT_ZOOM_IN_EASING,
	DEFAULT_ZOOM_IN_OVERLAP_MS,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	DEFAULT_ZOOM_OUT_DURATION_MS,
	DEFAULT_ZOOM_OUT_EASING,
	DEFAULT_ZOOM_SPEED,
	type EditorEffectSection,
	extendAutoFullTrackClip,
	type FigureData,
	getClipSourceEndMs,
	getTimelineDurationMs,
	type Padding,
	type PanRegion,
	type PanSpeed,
	mapSourceTimeToTimelineTime as resolveSourceTimeToTimelineTime,
	mapTimelineTimeToSourceTime as resolveTimelineTimeToSourceTime,
	type SpeedRegion,
	type TrimRegion,
	trimsToClips,
	type WebcamOverlaySettings,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomMode,
	type ZoomMotionBlurTuning,
	type ZoomRegion,
	type ZoomSpeed,
	type ZoomTransitionEasing,
} from "./types";
import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import {
	buildLoopedCursorTelemetry,
	getDisplayedTimelineWindowMs,
} from "./videoPlayback/cursorLoopTelemetry";

type EditorHistorySnapshot = {
	zoomRegions: ZoomRegion[];
	panRegions: PanRegion[];
	clipRegions: ClipRegion[];
	speedRegions: SpeedRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	selectedZoomId: string | null;
	selectedPanId: string | null;
	selectedClipId: string | null;
	selectedAnnotationId: string | null;
	selectedAudioId: string | null;
};

type PendingExportSave = {
	fileName: string;
	// Exactly one of these is populated. `tempFilePath` is the preferred form
	// for MP4 exports — the main process holds the finished file on disk, so
	// "Save Again" just renames it instead of round-tripping through the
	// renderer's ArrayBuffer heap.
	arrayBuffer?: ArrayBuffer;
	tempFilePath?: string;
};

type CancelableExporter = {
	cancel(): void;
};

import {
	areDeepEqual,
	cloneStructured,
	getErrorMessage,
	type SaveProjectOptions,
	showExportErrorToast,
	summarizeErrorMessage,
} from "./editorErrorUtils";
import { streamExportBlobToTempFile } from "./editorExportStream";
import {
	getDevOpenRecordingConfig,
	getSmokeExportConfig,
	SMOKE_EXPORT_READY_TIMEOUT_MS,
	writeSmokeExportReport,
} from "./smokeExportConfig";

const DEFAULT_MP4_EXPORT_FRAME_RATE: ExportMp4FrameRate = 30;
const PROJECT_AUTOSAVE_DELAY_MS = 1000;

export default function VideoEditor() {
	const { t } = useI18n();
	const smokeExportConfig = useMemo(
		() => getSmokeExportConfig(typeof window === "undefined" ? "" : window.location.search),
		[],
	);
	const devOpenRecordingConfig = useMemo(
		() =>
			getDevOpenRecordingConfig(typeof window === "undefined" ? "" : window.location.search),
		[],
	);
	const [appPlatform, setAppPlatform] = useState<string>(
		typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "darwin" : "",
	);
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [videoSourcePath, setVideoSourcePath] = useState<string | null>(null);
	const videoSourcePathRef = useRef<string | null>(null);
	useEffect(() => {
		videoSourcePathRef.current = videoSourcePath;
	}, [videoSourcePath]);
	const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
	const [projectLibraryEntries, setProjectLibraryEntries] = useState<ProjectLibraryEntry[]>([]);
	const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | null>(null);
	const [projectBrowserOpen, setProjectBrowserOpen] = useState(false);
	const [isEditingProjectName, setIsEditingProjectName] = useState(false);
	const [projectNameDraft, setProjectNameDraft] = useState("");
	const [isSavingProjectName, setIsSavingProjectName] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [wallpaper, setWallpaper] = useState<string>(initialEditorPreferences.wallpaper);
	const [shadowIntensity, setShadowIntensity] = useState(
		initialEditorPreferences.shadowIntensity,
	);
	const [backgroundBlur, setBackgroundBlur] = useState(initialEditorPreferences.backgroundBlur);
	const [zoomMotionBlur, setZoomMotionBlur] = useState(initialEditorPreferences.zoomMotionBlur);
	const [zoomMotionBlurTuning, setZoomMotionBlurTuning] = useState<ZoomMotionBlurTuning>(
		initialEditorPreferences.zoomMotionBlurTuning ?? DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	);
	const [zoomTemporalMotionBlur, setZoomTemporalMotionBlur] = useState(
		initialEditorPreferences.zoomTemporalMotionBlur,
	);
	const [zoomMotionBlurSampleCount, setZoomMotionBlurSampleCount] = useState<number | null>(
		initialEditorPreferences.zoomMotionBlurSampleCount,
	);
	const [zoomMotionBlurShutterFraction, setZoomMotionBlurShutterFraction] = useState<
		number | null
	>(initialEditorPreferences.zoomMotionBlurShutterFraction);
	const [autoApplyFreshRecordingAutoZooms, setAutoApplyFreshRecordingAutoZooms] = useState(
		initialEditorPreferences.autoApplyFreshRecordingAutoZooms,
	);
	const [connectZooms, setConnectZooms] = useState(false);
	const [zoomInDurationMs, setZoomInDurationMs] = useState(
		initialEditorPreferences.zoomInDurationMs ?? DEFAULT_ZOOM_IN_DURATION_MS,
	);
	const [zoomInOverlapMs, setZoomInOverlapMs] = useState(
		initialEditorPreferences.zoomInOverlapMs ?? DEFAULT_ZOOM_IN_OVERLAP_MS,
	);
	const [zoomOutDurationMs, setZoomOutDurationMs] = useState(
		initialEditorPreferences.zoomOutDurationMs ?? DEFAULT_ZOOM_OUT_DURATION_MS,
	);
	const [connectedZoomGapMs, setConnectedZoomGapMs] = useState(
		initialEditorPreferences.connectedZoomGapMs ?? DEFAULT_CONNECTED_ZOOM_GAP_MS,
	);
	const [connectedZoomDurationMs, setConnectedZoomDurationMs] = useState(
		initialEditorPreferences.connectedZoomDurationMs ?? DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	);
	const [zoomInEasing, setZoomInEasing] = useState<ZoomTransitionEasing>(
		initialEditorPreferences.zoomInEasing ?? DEFAULT_ZOOM_IN_EASING,
	);
	const [zoomOutEasing, setZoomOutEasing] = useState<ZoomTransitionEasing>(
		initialEditorPreferences.zoomOutEasing ?? DEFAULT_ZOOM_OUT_EASING,
	);
	const [connectedZoomEasing, setConnectedZoomEasing] = useState<ZoomTransitionEasing>(
		initialEditorPreferences.connectedZoomEasing ?? DEFAULT_CONNECTED_ZOOM_EASING,
	);
	const [showCursor, setShowCursor] = useState(initialEditorPreferences.showCursor);
	const [loopCursor, setLoopCursor] = useState(initialEditorPreferences.loopCursor);
	const [cursorStyle, setCursorStyle] = useState<CursorStyle>(
		initialEditorPreferences.cursorStyle ?? DEFAULT_CURSOR_STYLE,
	);
	const [cursorSize, setCursorSize] = useState(initialEditorPreferences.cursorSize);
	const [cursorSmoothing, setCursorSmoothing] = useState(
		initialEditorPreferences.cursorSmoothing,
	);
	const [cursorSpringStiffnessMultiplier, setCursorSpringStiffnessMultiplier] = useState(
		initialEditorPreferences.cursorSpringStiffnessMultiplier,
	);
	const [cursorSpringDampingMultiplier, setCursorSpringDampingMultiplier] = useState(
		initialEditorPreferences.cursorSpringDampingMultiplier,
	);
	const [cursorSpringMassMultiplier, setCursorSpringMassMultiplier] = useState(
		initialEditorPreferences.cursorSpringMassMultiplier,
	);
	const [cameraSpringStiffnessMultiplier, setCameraSpringStiffnessMultiplier] = useState(
		initialEditorPreferences.cameraSpringStiffnessMultiplier,
	);
	const [cameraSpringDampingMultiplier, setCameraSpringDampingMultiplier] = useState(
		initialEditorPreferences.cameraSpringDampingMultiplier,
	);
	const [cameraSpringMassMultiplier, setCameraSpringMassMultiplier] = useState(
		initialEditorPreferences.cameraSpringMassMultiplier,
	);
	const [sessionShowCursorOverride, setSessionShowCursorOverride] = useState<boolean | null>(
		null,
	);
	const [sessionNativeCaptureUnavailable, setSessionNativeCaptureUnavailable] = useState(false);
	const [nativeCaptureUnavailableModalOpen, setNativeCaptureUnavailableModalOpen] =
		useState(false);
	const [zoomSmoothness, setZoomSmoothness] = useState(0.5);
	const [zoomSpeed, setZoomSpeed] = useState<ZoomSpeed>(DEFAULT_ZOOM_SPEED);
	const [zoomClassicMode, setZoomClassicMode] = useState(false);
	const [cursorMotionBlur, setCursorMotionBlur] = useState(
		initialEditorPreferences.cursorMotionBlur,
	);
	const [cursorClickBounce, setCursorClickBounce] = useState(
		initialEditorPreferences.cursorClickBounce,
	);
	const [cursorClickBounceDuration, setCursorClickBounceDuration] = useState(
		initialEditorPreferences.cursorClickBounceDuration,
	);
	const [showClickEffect, setShowClickEffect] = useState(
		initialEditorPreferences.showClickEffect ?? true,
	);
	const [smartCameraEnabled, setSmartCameraEnabled] = useState(
		initialEditorPreferences.smartCameraEnabled ?? true,
	);
	const [smartCameraScale, setSmartCameraScale] = useState(
		initialEditorPreferences.smartCameraScale ?? 1.5,
	);
	const [clickEffectStyle, setClickEffectStyle] = useState<string>("ring");
	const [clickEffectSize, setClickEffectSize] = useState(1);
	const [clickSound, setClickSound] = useState(false);
	const [clickSoundStyle, setClickSoundStyle] = useState<ClickSoundStyle>("crisp");
	const [clickSoundVolume, setClickSoundVolume] = useState<number>(0.7);
	const [cursorSway, setCursorSway] = useState(initialEditorPreferences.cursorSway);
	const [borderRadius, setBorderRadius] = useState(initialEditorPreferences.borderRadius);
	const [padding, setPadding] = useState(initialEditorPreferences.padding);
	const [frame, setFrame] = useState<string | null>(initialEditorPreferences.frame);
	const [cropRegion, setCropRegion] = useState<CropRegion>(DEFAULT_CROP_REGION);
	const [webcam, setWebcam] = useState<WebcamOverlaySettings>(
		initialEditorPreferences.webcam ?? DEFAULT_WEBCAM_OVERLAY,
	);
	const [resolvedWebcamVideoUrl, setResolvedWebcamVideoUrl] = useState<string | null>(null);
	const [recordWebcamDialogOpen, setRecordWebcamDialogOpen] = useState<boolean>(false);
	const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
	const [panRegions, setPanRegions] = useState<PanRegion[]>([]);
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>([]);
	// Tracks the videoSourcePath for which the cursor telemetry IPC has already
	// resolved. The smoke-export auto-trigger waits on this so long recordings
	// still bake cursor/zoom animations into the output — without it, the
	// auto-export fires as soon as the video loads and the telemetry arrives
	// after encoding has started.
	const [cursorTelemetrySourcePath, setCursorTelemetrySourcePath] = useState<string | null>(null);
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [selectedPanId, setSelectedPanId] = useState<string | null>(null);
	const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
	const [clipRegions, setClipRegions] = useState<ClipRegion[]>([]);
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [speedRegions, setSpeedRegions] = useState<SpeedRegion[]>([]);
	const [annotationRegions, setAnnotationRegions] = useState<AnnotationRegion[]>([]);
	const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
	const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);
	const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
	const [sourceAudioTrackSettingsByClip, setSourceAudioTrackSettingsByClip] = useState<
		Record<string, SourceAudioTrackSettings>
	>({});
	const [defaultSourceAudioTrackSettings, setDefaultSourceAudioTrackSettings] =
		useState<SourceAudioTrackSettings>({});
	const [hasClipSourceAudio, setHasClipSourceAudio] = useState(false);
	// Captions were removed from the editor. Caption fields found in an existing
	// project file are kept verbatim and written back on save, so no data is lost.
	// They are tied to the source video they were loaded with, so they never leak
	// into a project for a different recording.
	const legacyCaptionFieldsRef = useRef<{
		sourcePath: string | null;
		fields: { autoCaptions?: unknown; autoCaptionSettings?: unknown };
	}>({ sourcePath: null, fields: {} });
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);
	const [showExportDropdown, setShowExportDropdown] = useState(false);
	const [previewVolume, setPreviewVolume] = useState(1);
	const applySessionPresentation = useCallback(
		(
			session:
				| {
						hideOverlayCursorByDefault?: boolean;
						nativeCaptureUnavailable?: boolean;
				  }
				| null
				| undefined,
		) => {
			setSessionShowCursorOverride(session?.hideOverlayCursorByDefault ? false : null);
			setSessionNativeCaptureUnavailable(Boolean(session?.nativeCaptureUnavailable));
			setNativeCaptureUnavailableModalOpen(Boolean(session?.nativeCaptureUnavailable));
		},
		[],
	);
	const effectiveShowCursor = sessionShowCursorOverride ?? showCursor;
	const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
		initialEditorPreferences.aspectRatio,
	);
	const [activeEffectSection, setActiveEffectSection] = useState<EditorEffectSection>("scene");
	const [exportQuality, setExportQuality] = useState<ExportQuality>(
		initialEditorPreferences.exportQuality,
	);
	const [exportEncodingMode, setExportEncodingMode] = useState<ExportEncodingMode>(
		initialEditorPreferences.exportEncodingMode,
	);
	const [exportBackendPreference, setExportBackendPreference] = useState<ExportBackendPreference>(
		initialEditorPreferences.exportBackendPreference,
	);
	const [exportPipelineModel, setExportPipelineModel] = useState<ExportPipelineModel>(
		initialEditorPreferences.exportPipelineModel,
	);
	const [mp4FrameRate, setMp4FrameRate] = useState<ExportMp4FrameRate>(
		initialEditorPreferences.mp4FrameRate ?? DEFAULT_MP4_EXPORT_FRAME_RATE,
	);
	const [exportFormat, setExportFormat] = useState<ExportFormat>(
		initialEditorPreferences.exportFormat,
	);
	const [gifFrameRate, setGifFrameRate] = useState<GifFrameRate>(
		initialEditorPreferences.gifFrameRate,
	);
	const [gifLoop, setGifLoop] = useState(initialEditorPreferences.gifLoop);
	const [gifSizePreset, setGifSizePreset] = useState<GifSizePreset>(
		initialEditorPreferences.gifSizePreset,
	);
	const [exportedFilePath, setExportedFilePath] = useState<string | undefined>(undefined);
	const [hasPendingExportSave, setHasPendingExportSave] = useState(false);
	const [lastSavedSnapshot, setLastSavedSnapshot] = useState<EditorProjectData | null>(null);

	const [showCropModal, setShowCropModal] = useState(false);
	const [previewVersion, setPreviewVersion] = useState(0);
	const [isPreviewReady, setIsPreviewReady] = useState(false);
	const [autoSuggestZoomsTrigger, setAutoSuggestZoomsTrigger] = useState(0);
	const [licenseModalOpen, setLicenseModalOpen] = useState(false);
	const [isProUser, setIsProUser] = useState(false);
	const [freeTrialRemaining, setFreeTrialRemaining] = useState<number>(5);

	useEffect(() => {
		const updateStatus = () => {
			window.electronAPI?.getRecordingUsage?.().then((usage) => {
				setIsProUser(Boolean(usage?.isPro));
				setFreeTrialRemaining(typeof usage?.remaining === "number" ? usage.remaining : 0);
			}).catch(() => {});
		};
		updateStatus();

		const unsub = window.electronAPI?.onLicenseRevoked?.((payload) => {
			setIsProUser(false);
			toast.error(payload.message || "Bản quyền đã bị Quản trị viên xóa trên hệ thống!");
		});

		return () => {
			unsub?.();
		};
	}, []);

	useEffect(() => {
		if (!licenseModalOpen) {
			window.electronAPI?.getRecordingUsage?.().then((usage) => {
				setIsProUser(Boolean(usage?.isPro));
				setFreeTrialRemaining(typeof usage?.remaining === "number" ? usage.remaining : 0);
			}).catch(() => {});
		}
	}, [licenseModalOpen]);

	const headerLeftControlsPaddingClass = appPlatform === "darwin" ? "pl-[76px]" : "";

	const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
	const projectBrowserTriggerRef = useRef<HTMLButtonElement | null>(null);
	const projectBrowserFallbackTriggerRef = useRef<HTMLButtonElement | null>(null);
	const projectNameInputRef = useRef<HTMLInputElement | null>(null);
	const nextZoomIdRef = useRef(1);
	const nextPanIdRef = useRef(1);
	const nextClipIdRef = useRef(1);
	const nextAudioIdRef = useRef(1);
	const handleAudioAddedRef = useRef<
		((span: Span, audioPath: string, trackIndex?: number) => void) | null
	>(null);

	const { shortcuts, isMac } = useShortcuts();
	const nextAnnotationIdRef = useRef(1);
	const nextAnnotationZIndexRef = useRef(1); // Track z-index for stacking order
	const exporterRef = useRef<CancelableExporter | null>(null);
	const autoSuggestedVideoPathRef = useRef<string | null>(null);
	const pendingFreshRecordingAutoZoomPathRef = useRef<string | null>(null);
	const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
	const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
	const historyCurrentRef = useRef<EditorHistorySnapshot | null>(null);
	const applyingHistoryRef = useRef(false);
	const pendingExportSaveRef = useRef<PendingExportSave | null>(null);
	const pendingTelemetryRetryTimeoutRef = useRef<number | null>(null);
	const pendingFreshRecordingAutoSuggestTimeoutRef = useRef<number | null>(null);
	const pendingFreshRecordingAutoSuggestTelemetryCountRef = useRef(0);
	const cropSnapshotRef = useRef<CropRegion | null>(null);
	const mp4SupportRequestRef = useRef(0);
	const smokeExportStartedRef = useRef(false);
	const projectAutosaveTimeoutRef = useRef<number | null>(null);
	const projectSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
	const smokeExportReadyStateRef = useRef<Record<string, unknown>>({});
	const [historyVersion, setHistoryVersion] = useState(0);
	const timelineRef = useRef<TimelineEditorHandle>(null);

	function formatTime(seconds: number) {
		if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

	const [timelineCollapsed, setTimelineCollapsed] = useState(false);

	const [timelineHeight, setTimelineHeight] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("recordly:timeline-height");
			if (saved) {
				const parsed = Number.parseInt(saved, 10);
				if (!Number.isNaN(parsed) && parsed >= 140 && parsed <= 900) {
					return parsed;
				}
			}
		} catch {
			// Ignore
		}
		return 220;
	});

	const handleTimelineResizeStart = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.preventDefault();
			const startY = e.clientY;
			const startHeight = timelineHeight;

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const deltaY = startY - moveEvent.clientY;
				const maxHeight = Math.max(300, Math.floor(window.innerHeight * 0.65));
				const newHeight = Math.max(140, Math.min(maxHeight, startHeight + deltaY));
				setTimelineHeight(newHeight);
			};

			const handlePointerUp = () => {
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
				setTimelineHeight((finalHeight) => {
					try {
						localStorage.setItem("recordly:timeline-height", String(finalHeight));
					} catch {
						// Ignore
					}
					return finalHeight;
				});
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		},
		[timelineHeight],
	);

	useEffect(() => {
		void window.electronAPI?.getPlatform?.()?.then((platform) => {
			setAppPlatform(platform);
		});
	}, []);

	useEffect(() => {
		autoSuggestedVideoPathRef.current = null;
		pendingFreshRecordingAutoSuggestTelemetryCountRef.current = 0;
		if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
		}
	}, []);

	// Auto-activate builtin extensions at editor startup (idempotent)
	useEffect(() => {
		extensionHost.autoActivateBuiltins();
	}, []);

	const [supportedMp4SourceDimensions, setSupportedMp4SourceDimensions] =
		useState<SupportedMp4Dimensions>({
			width: 1920,
			height: 1080,
			capped: false,
			encoderPath: null,
		});

	const syncHistoryButtons = useCallback(() => {
		setHistoryVersion((version) => version + 1);
	}, []);



	const clearPendingExportSave = useCallback(() => {
		const pending = pendingExportSaveRef.current;
		pendingExportSaveRef.current = null;
		setHasPendingExportSave(false);
		if (pending?.tempFilePath && typeof window !== "undefined") {
			// Best-effort cleanup — main-process also reaps stale temp files on
			// before-quit, so we ignore failures here.
			void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
		}
	}, []);

	const refreshProjectLibrary = useCallback(async () => {
		try {
			const result = await window.electronAPI.listProjectFiles();
			if (!result.success) {
				throw new Error(result.error || "Failed to load project library");
			}

			setProjectLibraryEntries(result.entries);
		} catch (projectLibraryError) {
			console.warn("Unable to refresh project library:", projectLibraryError);
		}
	}, []);

	const captureProjectThumbnail = useCallback(async () => {
		const previewHandle = videoPlaybackRef.current;
		const previewVideo = previewHandle?.video ?? null;
		const previewCanvas = previewHandle?.app?.canvas ?? null;

		if (previewHandle && previewVideo && previewVideo.paused) {
			try {
				await previewHandle.refreshFrame();
				await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
			} catch (thumbnailRefreshError) {
				console.warn(
					"Unable to refresh preview frame before thumbnail capture:",
					thumbnailRefreshError,
				);
			}
		}

		const canvas = document.createElement("canvas");
		const targetWidth = 320;
		const targetHeight = 180;
		canvas.width = targetWidth;
		canvas.height = targetHeight;

		const context = canvas.getContext("2d");
		if (!context) {
			return null;
		}
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		const editorBgHsl = getComputedStyle(document.documentElement)
			.getPropertyValue("--editor-bg")
			.trim();
		context.fillStyle = editorBgHsl ? `hsl(${editorBgHsl})` : "#111113";
		context.fillRect(0, 0, targetWidth, targetHeight);

		const previewWidth = previewHandle?.containerRef.current?.clientWidth || 1920;
		const previewHeight = previewHandle?.containerRef.current?.clientHeight || 1080;
		const frameTimestampUs = Math.max(0, Math.round(currentTime * 1_000_000));

		if (previewVideo && previewVideo.videoWidth > 0 && previewVideo.videoHeight > 0) {
			let videoFrame: VideoFrame | null = null;
			let frameRenderer: FrameRenderer | null = null;

			try {
				videoFrame = new VideoFrame(previewVideo, { timestamp: frameTimestampUs });
				frameRenderer = new FrameRenderer({
					width: targetWidth,
					height: targetHeight,
					wallpaper,
					zoomRegions,
					showShadow: shadowIntensity > 0,
					shadowIntensity,
					backgroundBlur,
					zoomMotionBlur,
					zoomMotionBlurTuning,
					zoomTemporalMotionBlur,
					zoomMotionBlurSampleCount,
					zoomMotionBlurShutterFraction,
					connectZooms,
					zoomInDurationMs,
					zoomInOverlapMs,
					zoomOutDurationMs,
					connectedZoomGapMs,
					connectedZoomDurationMs,
					zoomInEasing,
					zoomOutEasing,
					connectedZoomEasing,
					borderRadius,
					padding,
					cropRegion,
					webcam,
					webcamUrl:
						resolvedWebcamVideoUrl ??
						(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
					videoWidth: previewVideo.videoWidth,
					videoHeight: previewVideo.videoHeight,
					annotationRegions,
					speedRegions: (() => {
						const clipDerived: SpeedRegion[] = clipRegions
							.filter((clip) => clip.speed !== 1)
							.map((clip) => ({
								id: `clip-speed-${clip.id}`,
								startMs: clip.startMs,
								endMs: getClipSourceEndMs(clip),
								speed: clip.speed as SpeedRegion["speed"],
							}));
						if (clipDerived.length === 0) return speedRegions;
						const result = [...speedRegions];
						for (const cs of clipDerived) {
							const overlaps = speedRegions.some(
								(sr) => sr.endMs > cs.startMs && sr.startMs < cs.endMs,
							);
							if (!overlaps) {
								result.push(cs);
							}
						}
						return result;
					})(),
					previewWidth,
					previewHeight,
					cursorTelemetry,
					showCursor: effectiveShowCursor,
					cursorStyle,
					cursorSize,
					cursorSmoothing,
					cursorSpringStiffnessMultiplier,
					cursorSpringDampingMultiplier,
					cursorSpringMassMultiplier,
					cameraSpringStiffnessMultiplier,
					cameraSpringDampingMultiplier,
					cameraSpringMassMultiplier,
					zoomSmoothness,
					zoomSpeed,
					zoomClassicMode,
					cursorMotionBlur,
					cursorClickBounce,
					cursorClickBounceDuration,
					cursorSway,
				});
				await frameRenderer.initialize();
				await frameRenderer.renderFrame(videoFrame, frameTimestampUs);
				return frameRenderer.getCanvas().toDataURL("image/png");
			} catch (thumbnailRenderError) {
				console.warn(
					"Unable to render thumbnail from composed frame:",
					thumbnailRenderError,
				);
			} finally {
				videoFrame?.close();
				frameRenderer?.destroy();
			}
		}

		const drawableSource =
			previewCanvas && previewCanvas.width > 0 && previewCanvas.height > 0
				? previewCanvas
				: previewVideo && previewVideo.videoWidth > 0 && previewVideo.videoHeight > 0
					? previewVideo
					: null;

		if (!drawableSource) {
			return null;
		}

		const sourceWidth =
			drawableSource instanceof HTMLVideoElement
				? drawableSource.videoWidth
				: drawableSource.width;
		const sourceHeight =
			drawableSource instanceof HTMLVideoElement
				? drawableSource.videoHeight
				: drawableSource.height;

		if (sourceWidth <= 0 || sourceHeight <= 0) {
			return null;
		}

		const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
		const drawWidth = Math.round(sourceWidth * scale);
		const drawHeight = Math.round(sourceHeight * scale);
		const offsetX = Math.round((targetWidth - drawWidth) / 2);
		const offsetY = Math.round((targetHeight - drawHeight) / 2);

		try {
			context.drawImage(drawableSource, offsetX, offsetY, drawWidth, drawHeight);
			return canvas.toDataURL("image/png");
		} catch (thumbnailError) {
			console.warn("Unable to capture project thumbnail:", thumbnailError);
			return null;
		}
	}, [
		annotationRegions,
		backgroundBlur,
		borderRadius,
		connectZooms,
		connectedZoomDurationMs,
		connectedZoomEasing,
		connectedZoomGapMs,
		cropRegion,
		currentTime,
		cursorClickBounce,
		cursorClickBounceDuration,
		cursorMotionBlur,
		cursorSize,
		cursorSmoothing,
		cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier,
		cursorSpringStiffnessMultiplier,
		cameraSpringStiffnessMultiplier,
		cameraSpringDampingMultiplier,
		cameraSpringMassMultiplier,
		zoomSmoothness,
		zoomSpeed,
		cursorStyle,
		cursorSway,
		cursorTelemetry,
		clipRegions,
		padding,
		resolvedWebcamVideoUrl,
		shadowIntensity,
		effectiveShowCursor,
		speedRegions,
		wallpaper,
		webcam,
		zoomInDurationMs,
		zoomInEasing,
		zoomInOverlapMs,
		zoomMotionBlur,
		zoomMotionBlurTuning,
		zoomTemporalMotionBlur,
		zoomMotionBlurSampleCount,
		zoomMotionBlurShutterFraction,
		zoomOutDurationMs,
		zoomOutEasing,
		zoomRegions,
		zoomClassicMode,
	]);

	const markExportAsSaving = useCallback(() => {
		setExportProgress((previous) => ({
			currentFrame: previous?.totalFrames ?? previous?.currentFrame ?? 1,
			totalFrames: previous?.totalFrames ?? previous?.currentFrame ?? 1,
			percentage: 100,
			estimatedTimeRemaining: 0,
			renderFps: previous?.renderFps,
			renderBackend: previous?.renderBackend,
			encodeBackend: previous?.encodeBackend,
			encoderName: previous?.encoderName,
			phase: "saving",
		}));
	}, []);

	const handleShowCursorChange = useCallback((nextShowCursor: boolean) => {
		setSessionShowCursorOverride(null);
		setShowCursor(nextShowCursor);
	}, []);

	const remountPreview = useCallback(() => {
		setIsPreviewReady(false);
		setPreviewVersion((version) => version + 1);
	}, []);

	const clearPendingProjectAutosave = useCallback(() => {
		if (projectAutosaveTimeoutRef.current !== null) {
			window.clearTimeout(projectAutosaveTimeoutRef.current);
			projectAutosaveTimeoutRef.current = null;
		}
	}, []);

	const queueProjectSave = useCallback((task: () => Promise<boolean>) => {
		const run = projectSaveQueueRef.current.catch(() => undefined).then(task);
		projectSaveQueueRef.current = run.catch(() => undefined);
		return run;
	}, []);

	const saveBlobExport = useCallback(
		async (blob: Blob, fileName: string, outputPath: string | null = null) => {
			const extension = fileName.split(".").pop()?.toLowerCase() || "bin";
			const hasExportStreamApi =
				typeof window !== "undefined" &&
				typeof window.electronAPI?.openExportStream === "function" &&
				typeof window.electronAPI?.writeExportStreamChunk === "function" &&
				typeof window.electronAPI?.closeExportStream === "function";
			let streamError: unknown = null;

			try {
				const tempFilePath = await streamExportBlobToTempFile(blob, extension);
				if (tempFilePath) {
					return {
						saveResult: await window.electronAPI.finalizeExportedVideo({
							tempPath: tempFilePath,
							fileName,
							outputPath,
						}),
						pendingSave: {
							fileName,
							tempFilePath,
						} satisfies PendingExportSave,
					};
				}
			} catch (error) {
				streamError = error;
				console.warn("[export] Temp-file blob save failed", error);
			}

			if (
				!canUseInMemoryExportSaveFallback({
					blobSize: blob.size,
					extension,
					hasExportStreamApi,
				})
			) {
				const message = describeBlockedInMemoryExportSave({
					blobSize: blob.size,
					extension,
				});
				console.error("[export] Refusing in-memory blob save fallback", {
					fileName,
					blobSize: blob.size,
					extension,
					hasExportStreamApi,
					streamError,
				});
				throw new Error(message);
			}

			console.warn("[export] Falling back to in-memory blob save", {
				fileName,
				blobSize: blob.size,
				extension,
				hasExportStreamApi,
			});
			const arrayBuffer = await blob.arrayBuffer();
			return {
				saveResult: outputPath
					? await window.electronAPI.writeExportedVideoToPath(arrayBuffer, outputPath)
					: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName),
				pendingSave: {
					fileName,
					arrayBuffer,
				} satisfies PendingExportSave,
			};
		},
		[],
	);

	useEffect(() => {
		return () => {
			exporterRef.current?.cancel();
			exporterRef.current = null;
			const pending = pendingExportSaveRef.current;
			pendingExportSaveRef.current = null;
			if (pending?.tempFilePath && typeof window !== "undefined") {
				void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
			}
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
				pendingTelemetryRetryTimeoutRef.current = null;
			}
			if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
				pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			}
			if (projectAutosaveTimeoutRef.current !== null) {
				window.clearTimeout(projectAutosaveTimeoutRef.current);
				projectAutosaveTimeoutRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		void refreshProjectLibrary();
	}, [refreshProjectLibrary]);

	const canUndo = historyPastRef.current.length > 0;
	const canRedo = historyFutureRef.current.length > 0;

	void historyVersion;

	const cloneSnapshot = useCallback((snapshot: EditorHistorySnapshot): EditorHistorySnapshot => {
		return cloneStructured(snapshot);
	}, []);

	const gifOutputDimensions = useMemo(
		() =>
			calculateOutputDimensions(
				videoPlaybackRef.current?.video?.videoWidth || 1920,
				videoPlaybackRef.current?.video?.videoHeight || 1080,
				gifSizePreset,
				GIF_SIZE_PRESETS,
			),
		[gifSizePreset],
	);

	const desiredMp4SourceDimensions = useMemo(
		() =>
			calculateMp4SourceDimensions(
				videoPlaybackRef.current?.video?.videoWidth || 1920,
				videoPlaybackRef.current?.video?.videoHeight || 1080,
				aspectRatio,
			),
		[aspectRatio],
	);

	const mp4OutputDimensions = useMemo(() => {
		const baseWidth = supportedMp4SourceDimensions.encoderPath
			? supportedMp4SourceDimensions.width
			: desiredMp4SourceDimensions.width;
		const baseHeight = supportedMp4SourceDimensions.encoderPath
			? supportedMp4SourceDimensions.height
			: desiredMp4SourceDimensions.height;

		return {
			medium: calculateMp4ExportDimensions(baseWidth, baseHeight, "medium"),
			good: calculateMp4ExportDimensions(baseWidth, baseHeight, "good"),
			high: calculateMp4ExportDimensions(baseWidth, baseHeight, "high"),
			source: calculateMp4ExportDimensions(baseWidth, baseHeight, "source"),
			"4k": calculateMp4ExportDimensions(baseWidth, baseHeight, "4k"),
		};
	}, [
		desiredMp4SourceDimensions.height,
		desiredMp4SourceDimensions.width,
		supportedMp4SourceDimensions.encoderPath,
		supportedMp4SourceDimensions.height,
		supportedMp4SourceDimensions.width,
	]);

	const ensureSupportedMp4SourceDimensions = useCallback(
		async (frameRate: ExportMp4FrameRate) => {
			const result = await probeSupportedMp4Dimensions({
				width: desiredMp4SourceDimensions.width,
				height: desiredMp4SourceDimensions.height,
				frameRate,
				codec: DEFAULT_MP4_CODEC,
				getBitrate: getSourceQualityBitrate,
			});

			if (!result.encoderPath) {
				throw new Error(
					`Video encoding not supported on this system. Tried codec ${DEFAULT_MP4_CODEC} at ${frameRate} FPS up to ${desiredMp4SourceDimensions.width}x${desiredMp4SourceDimensions.height}.`,
				);
			}

			setSupportedMp4SourceDimensions((current) => {
				if (
					current.width === result.width &&
					current.height === result.height &&
					current.capped === result.capped &&
					current.encoderPath?.codec === result.encoderPath?.codec &&
					current.encoderPath?.hardwareAcceleration ===
						result.encoderPath?.hardwareAcceleration
				) {
					return current;
				}

				return result;
			});

			return result;
		},
		[desiredMp4SourceDimensions.height, desiredMp4SourceDimensions.width],
	);

	useEffect(() => {
		let cancelled = false;
		const requestId = mp4SupportRequestRef.current + 1;
		mp4SupportRequestRef.current = requestId;
		setSupportedMp4SourceDimensions({
			width: desiredMp4SourceDimensions.width,
			height: desiredMp4SourceDimensions.height,
			capped: false,
			encoderPath: null,
		});

		void ensureSupportedMp4SourceDimensions(mp4FrameRate)
			.then((result) => {
				if (cancelled || requestId !== mp4SupportRequestRef.current) {
					return;
				}
				setSupportedMp4SourceDimensions(result);
			})
			.catch(() => {
				if (cancelled || requestId !== mp4SupportRequestRef.current) {
					return;
				}
				setSupportedMp4SourceDimensions({
					width: desiredMp4SourceDimensions.width,
					height: desiredMp4SourceDimensions.height,
					capped: false,
					encoderPath: null,
				});
			});

		return () => {
			cancelled = true;
		};
	}, [
		desiredMp4SourceDimensions.height,
		desiredMp4SourceDimensions.width,
		ensureSupportedMp4SourceDimensions,
		mp4FrameRate,
	]);

	// Extension-contributed standalone section pages (no parentSection)
	const [extensionSectionButtons, setExtensionSectionButtons] = useState<
		{
			id: EditorEffectSection;
			label: string;
			icon: typeof PhPuzzle | string;
			extensionPath?: string | null;
		}[]
	>([]);
	useEffect(() => {
		const update = () => {
			const panels = extensionHost.getSettingsPanels();
			const extensionPathById = new Map(
				extensionHost
					.getActiveExtensions()
					.map((extension) => [extension.manifest.id, extension.path]),
			);
			const standalone = panels
				.filter((p) => !p.panel.parentSection)
				.map((p) => ({
					id: `ext:${p.extensionId}/${p.panel.id}` as EditorEffectSection,
					label: p.panel.label,
					icon: p.panel.icon || (PhPuzzle as typeof PhPuzzle | string),
					extensionPath: extensionPathById.get(p.extensionId),
				}));
			setExtensionSectionButtons(standalone);
		};
		update();
		return extensionHost.onChange(update);
	}, []);

	const editorSectionButtons = useMemo(
		() => [
			{ id: "scene" as const, label: t("settings.sections.scene", "Scene"), icon: PhPalette },
			{
				id: "cursor" as const,
				label: t("settings.sections.cursor", "Cursor"),
				icon: PhCursorFill,
			},
			{
				id: "webcam" as const,
				label: t("settings.sections.webcam", "Webcam"),
				icon: PhCamera,
			},
			{
				id: "settings" as const,
				label: t("settings.sections.settings", "Settings"),
				icon: PhSettings,
			},
			{
				id: "audio" as const,
				label: t("settings.sections.audio", "Audio"),
				icon: PhAudio,
			},
			{
				id: "annotation" as const,
				label: t("settings.sections.annotation", "Chú thích"),
				icon: PhAnnotation,
			},
			...extensionSectionButtons,
		],
		[t, extensionSectionButtons],
	);

	useEffect(() => {
		// Captions were removed; fall back if an old session had that tab open.
		if (
			activeEffectSection === "frame" ||
			activeEffectSection === "crop" ||
			(activeEffectSection as string) === "captions"
		) {
			setActiveEffectSection("scene");
		}
	}, [activeEffectSection]);

	const buildPersistedEditorState = useCallback(
		(
			editor: Partial<{
				wallpaper: string;
				shadowIntensity: number;
				backgroundBlur: number;
				zoomMotionBlur: number;
				zoomMotionBlurTuning: ZoomMotionBlurTuning;
				zoomTemporalMotionBlur: number;
				zoomMotionBlurSampleCount: number | null;
				zoomMotionBlurShutterFraction: number | null;
				connectZooms: boolean;
				zoomInDurationMs: number;
				zoomInOverlapMs: number;
				zoomOutDurationMs: number;
				connectedZoomGapMs: number;
				connectedZoomDurationMs: number;
				zoomInEasing: ZoomTransitionEasing;
				zoomOutEasing: ZoomTransitionEasing;
				connectedZoomEasing: ZoomTransitionEasing;
				showCursor: boolean;
				loopCursor: boolean;
				cursorStyle: CursorStyle;
				cursorSize: number;
				cursorSmoothing: number;
				cursorSpringStiffnessMultiplier: number;
				cursorSpringDampingMultiplier: number;
				cursorSpringMassMultiplier: number;
				cameraSpringStiffnessMultiplier: number;
				cameraSpringDampingMultiplier: number;
				cameraSpringMassMultiplier: number;
				zoomSmoothness: number;
				zoomSpeed: ZoomSpeed;
				zoomClassicMode: boolean;
				cursorMotionBlur: number;
				cursorClickBounce: number;
				cursorClickBounceDuration: number;
				cursorSway: number;
				borderRadius: number;
				padding: Padding;
				frame: string | null;
				cropRegion: CropRegion;
				webcam: WebcamOverlaySettings;
				zoomRegions: ZoomRegion[];
				panRegions: PanRegion[];
				trimRegions: TrimRegion[];
				clipRegions: ClipRegion[];
				speedRegions: SpeedRegion[];
				annotationRegions: AnnotationRegion[];
				audioRegions: AudioRegion[];
				autoCaptions?: unknown;
				autoCaptionSettings?: unknown;
				aspectRatio: AspectRatio;
				exportEncodingMode: ExportEncodingMode;
				exportBackendPreference: ExportBackendPreference;
				exportPipelineModel: ExportPipelineModel;
				exportQuality: ExportQuality;
				mp4FrameRate: ExportMp4FrameRate;
				exportFormat: ExportFormat;
				gifFrameRate: GifFrameRate;
				gifLoop: boolean;
				gifSizePreset: GifSizePreset;
				sourceAudioTrackSettingsByClip: Record<string, SourceAudioTrackSettings>;
				defaultSourceAudioTrackSettings: SourceAudioTrackSettings;
			}>,
		) => {
			return stripPersistedDevMotionBlurSettings(editor);
		},
		[],
	);

	const currentSourcePath = useMemo(
		() => videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null),
		[videoPath, videoSourcePath],
	);
	const projectDisplayName = useMemo(() => {
		const fileName =
			currentProjectPath?.split(/[\\/]/).pop() ??
			currentSourcePath?.split(/[\\/]/).pop() ??
			"";
		const withoutExtension = fileName.replace(/\.recordly$/i, "").replace(/\.[^.]+$/, "");
		return withoutExtension || t("editor.project.untitled", "Untitled");
	}, [currentProjectPath, currentSourcePath, t]);

	const isAutoRecordingName = useMemo(() => {
		return /^recording(-\d+)?$/i.test(projectDisplayName) || projectDisplayName === "recording";
	}, [projectDisplayName]);

	const effectiveProjectDisplayName = useMemo(() => {
		if (isAutoRecordingName) {
			return "Record-AutoZoom";
		}
		return projectDisplayName;
	}, [isAutoRecordingName, projectDisplayName]);

	useEffect(() => {
		if (!isEditingProjectName) {
			setProjectNameDraft(effectiveProjectDisplayName);
		}
	}, [isEditingProjectName, effectiveProjectDisplayName]);

	useEffect(() => {
		if (!isEditingProjectName) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			projectNameInputRef.current?.focus();
			projectNameInputRef.current?.select();
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [isEditingProjectName]);

	const currentPersistedEditorState = useMemo(
		() =>
			buildPersistedEditorState({
				wallpaper,
				shadowIntensity,
				backgroundBlur,
				zoomMotionBlur,
				zoomMotionBlurTuning,
				zoomTemporalMotionBlur,
				zoomMotionBlurSampleCount,
				zoomMotionBlurShutterFraction,
				connectZooms,
				zoomInDurationMs,
				zoomInOverlapMs,
				zoomOutDurationMs,
				connectedZoomGapMs,
				connectedZoomDurationMs,
				zoomInEasing,
				zoomOutEasing,
				connectedZoomEasing,
				showCursor,
				loopCursor,
				cursorStyle,
				cursorSize,
				cursorSmoothing,
				cursorSpringStiffnessMultiplier,
				cursorSpringDampingMultiplier,
				cursorSpringMassMultiplier,
				cameraSpringStiffnessMultiplier,
				cameraSpringDampingMultiplier,
				cameraSpringMassMultiplier,
				zoomSmoothness,
				zoomSpeed,
				zoomClassicMode,
				cursorMotionBlur,
				cursorClickBounce,
				cursorClickBounceDuration,
				cursorSway,
				borderRadius,
				padding,
				frame,
				cropRegion,
				webcam,
				zoomRegions,
				panRegions,
				trimRegions,
				clipRegions,
				speedRegions,
				annotationRegions,
				audioRegions,
				...(legacyCaptionFieldsRef.current.sourcePath === videoSourcePath
					? legacyCaptionFieldsRef.current.fields
					: {}),
				aspectRatio,
				exportEncodingMode,
				exportBackendPreference,
				exportPipelineModel,
				exportQuality,
				mp4FrameRate,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
				sourceAudioTrackSettingsByClip,
				defaultSourceAudioTrackSettings,
			}),
		[
			buildPersistedEditorState,
			videoSourcePath,
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			zoomSmoothness,
			zoomSpeed,
			zoomClassicMode,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			borderRadius,
			padding,
			cropRegion,
			webcam,
			zoomRegions,
			trimRegions,
			clipRegions,
			speedRegions,
			annotationRegions,
			audioRegions,
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
			frame,
			sourceAudioTrackSettingsByClip,
			defaultSourceAudioTrackSettings,
		],
	);

	const buildHistorySnapshot = useCallback((): EditorHistorySnapshot => {
		return {
			zoomRegions,
			panRegions,
			clipRegions,
			speedRegions,
			annotationRegions,
			audioRegions,
			selectedZoomId,
			selectedPanId,
			selectedClipId,
			selectedAnnotationId,
			selectedAudioId,
		};
	}, [
		zoomRegions,
		panRegions,
		clipRegions,
		speedRegions,
		annotationRegions,
		audioRegions,
		selectedZoomId,
		selectedPanId,
		selectedClipId,
		selectedAnnotationId,
		selectedAudioId,
	]);

	const applyHistorySnapshot = useCallback(
		(snapshot: EditorHistorySnapshot) => {
			applyingHistoryRef.current = true;
			const cloned = cloneSnapshot(snapshot);
			setZoomRegions(cloned.zoomRegions);
			setPanRegions(cloned.panRegions ?? []);
			setClipRegions(cloned.clipRegions);
			setSpeedRegions(cloned.speedRegions);
			setAnnotationRegions(cloned.annotationRegions);
			setAudioRegions(cloned.audioRegions);
			setSelectedZoomId(cloned.selectedZoomId);
			setSelectedPanId(cloned.selectedPanId ?? null);
			setSelectedClipId(cloned.selectedClipId);
			setSelectedAnnotationId(cloned.selectedAnnotationId);
			setSelectedAudioId(cloned.selectedAudioId);

			nextZoomIdRef.current = deriveNextId(
				"zoom",
				cloned.zoomRegions.map((region) => region.id),
			);
			nextPanIdRef.current = deriveNextId(
				"pan",
				(cloned.panRegions ?? []).map((region) => region.id),
			);
			nextClipIdRef.current = deriveNextId(
				"clip",
				cloned.clipRegions.map((region) => region.id),
			);
			nextAnnotationIdRef.current = deriveNextId(
				"annotation",
				cloned.annotationRegions.map((region) => region.id),
			);
			nextAudioIdRef.current = deriveNextId(
				"audio",
				cloned.audioRegions.map((region) => region.id),
			);
			nextAnnotationZIndexRef.current =
				cloned.annotationRegions.reduce((max, region) => Math.max(max, region.zIndex), 0) +
				1;
		},
		[cloneSnapshot],
	);

	const handleUndo = useCallback(() => {
		if (historyPastRef.current.length === 0) return;

		const current = historyCurrentRef.current ?? cloneSnapshot(buildHistorySnapshot());
		const previous = historyPastRef.current.pop();
		if (!previous) return;

		historyFutureRef.current.push(cloneSnapshot(current));
		historyCurrentRef.current = cloneSnapshot(previous);
		applyHistorySnapshot(previous);
		syncHistoryButtons();
	}, [applyHistorySnapshot, buildHistorySnapshot, cloneSnapshot, syncHistoryButtons]);

	const handleRedo = useCallback(() => {
		if (historyFutureRef.current.length === 0) return;

		const current = historyCurrentRef.current ?? cloneSnapshot(buildHistorySnapshot());
		const next = historyFutureRef.current.pop();
		if (!next) return;

		historyPastRef.current.push(cloneSnapshot(current));
		historyCurrentRef.current = cloneSnapshot(next);
		applyHistorySnapshot(next);
		syncHistoryButtons();
	}, [applyHistorySnapshot, buildHistorySnapshot, cloneSnapshot, syncHistoryButtons]);

	const applyLoadedProject = useCallback(
		async (candidate: unknown, path?: string | null) => {
			if (!validateProjectData(candidate)) {
				return false;
			}

			const project = candidate;
			const sourcePath = fromFileUrl(project.videoPath);
			const normalizedEditor = normalizeProjectEditor(
				stripPersistedDevMotionBlurSettings(project.editor ?? {}),
			);

			try {
				videoPlaybackRef.current?.pause();
			} catch {
				// no-op
			}
			setIsPlaying(false);
			setCurrentTime(0);
			setDuration(0);

			setError(null);
			videoSourcePathRef.current = sourcePath;
			setVideoSourcePath(sourcePath);
			setVideoPath(await resolveVideoUrl(sourcePath));
			setCurrentProjectPath(path ?? null);
			pendingFreshRecordingAutoZoomPathRef.current = null;
			if (normalizedEditor.webcam.sourcePath) {
				await window.electronAPI.setCurrentRecordingSession?.(
					{
						videoPath: sourcePath,
						webcamPath: normalizedEditor.webcam.sourcePath,
						timeOffsetMs: normalizedEditor.webcam.timeOffsetMs,
					},
					{
						preserveProjectPath: Boolean(path),
					},
				);
				const sessionResult = await window.electronAPI.getCurrentRecordingSession?.();
				applySessionPresentation(sessionResult?.success ? sessionResult.session : null);
			} else {
				await window.electronAPI.setCurrentVideoPath(sourcePath, {
					preserveProjectPath: Boolean(path),
				});
				applySessionPresentation(null);
			}

			setWallpaper(normalizedEditor.wallpaper);
			setShadowIntensity(normalizedEditor.shadowIntensity);
			setBackgroundBlur(normalizedEditor.backgroundBlur);
			setZoomMotionBlur(normalizedEditor.zoomMotionBlur);
			setZoomMotionBlurTuning({ ...normalizedEditor.zoomMotionBlurTuning });
			setZoomTemporalMotionBlur(normalizedEditor.zoomTemporalMotionBlur);
			setZoomMotionBlurSampleCount(normalizedEditor.zoomMotionBlurSampleCount);
			setZoomMotionBlurShutterFraction(normalizedEditor.zoomMotionBlurShutterFraction);
			setConnectZooms(false);
			setZoomInDurationMs(normalizedEditor.zoomInDurationMs);
			setZoomInOverlapMs(normalizedEditor.zoomInOverlapMs);
			setZoomOutDurationMs(normalizedEditor.zoomOutDurationMs);
			setConnectedZoomGapMs(normalizedEditor.connectedZoomGapMs);
			setConnectedZoomDurationMs(normalizedEditor.connectedZoomDurationMs);
			setZoomInEasing(normalizedEditor.zoomInEasing);
			setZoomOutEasing(normalizedEditor.zoomOutEasing);
			setConnectedZoomEasing(normalizedEditor.connectedZoomEasing);
			setShowCursor(normalizedEditor.showCursor);
			setLoopCursor(normalizedEditor.loopCursor);
			setCursorStyle(normalizedEditor.cursorStyle);
			setCursorSize(normalizedEditor.cursorSize);
			setCursorSmoothing(normalizedEditor.cursorSmoothing);
			setCursorSpringStiffnessMultiplier(normalizedEditor.cursorSpringStiffnessMultiplier);
			setCursorSpringDampingMultiplier(normalizedEditor.cursorSpringDampingMultiplier);
			setCursorSpringMassMultiplier(normalizedEditor.cursorSpringMassMultiplier);
			setCameraSpringStiffnessMultiplier(normalizedEditor.cameraSpringStiffnessMultiplier);
			setCameraSpringDampingMultiplier(normalizedEditor.cameraSpringDampingMultiplier);
			setCameraSpringMassMultiplier(normalizedEditor.cameraSpringMassMultiplier);
			setZoomSmoothness(normalizedEditor.zoomSmoothness);
			setZoomSpeed(normalizedEditor.zoomSpeed);
			setZoomClassicMode(normalizedEditor.zoomClassicMode);
			setCursorMotionBlur(normalizedEditor.cursorMotionBlur);
			setCursorClickBounce(normalizedEditor.cursorClickBounce);
			setCursorClickBounceDuration(normalizedEditor.cursorClickBounceDuration);
			setCursorSway(normalizedEditor.cursorSway);
			setBorderRadius(normalizedEditor.borderRadius);
			setPadding(normalizedEditor.padding);
			setFrame(normalizedEditor.frame);
			setCropRegion(normalizedEditor.cropRegion);
			setWebcam(normalizedEditor.webcam);
			setZoomRegions(normalizedEditor.zoomRegions);
			setPanRegions(normalizedEditor.panRegions ?? []);
			setTrimRegions(normalizedEditor.trimRegions);
			setClipRegions(normalizedEditor.clipRegions);
			clipInitializedRef.current = normalizedEditor.clipRegions.length > 0;
			autoFullTrackClipIdRef.current = null;
			autoFullTrackClipEndMsRef.current = null;
			setSpeedRegions(normalizedEditor.speedRegions);
			setAnnotationRegions(normalizedEditor.annotationRegions);
			setAudioRegions(normalizedEditor.audioRegions);
			setSourceAudioTrackSettingsByClip(
				normalizedEditor.sourceAudioTrackSettingsByClip ?? {},
			);
			setDefaultSourceAudioTrackSettings(
				normalizedEditor.defaultSourceAudioTrackSettings ?? {},
			);
			legacyCaptionFieldsRef.current = {
				sourcePath,
				fields: {
					autoCaptions: normalizedEditor.autoCaptions,
					autoCaptionSettings: normalizedEditor.autoCaptionSettings,
				},
			};
			setAspectRatio(normalizedEditor.aspectRatio);
			setExportEncodingMode(normalizedEditor.exportEncodingMode);
			setExportBackendPreference(normalizedEditor.exportBackendPreference);
			setExportPipelineModel(normalizedEditor.exportPipelineModel);
			setExportQuality(normalizedEditor.exportQuality);
			setMp4FrameRate(normalizedEditor.mp4FrameRate);
			setExportFormat(normalizedEditor.exportFormat);
			setGifFrameRate(normalizedEditor.gifFrameRate);
			setGifLoop(normalizedEditor.gifLoop);
			setGifSizePreset(normalizedEditor.gifSizePreset);

			setSelectedZoomId(null);
			setSelectedPanId(null);
			setSelectedClipId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);

			nextZoomIdRef.current = deriveNextId(
				"zoom",
				normalizedEditor.zoomRegions.map((region) => region.id),
			);
			nextPanIdRef.current = deriveNextId(
				"pan",
				(normalizedEditor.panRegions ?? []).map((region) => region.id),
			);
			nextClipIdRef.current = deriveNextId(
				"clip",
				normalizedEditor.clipRegions.map((region: ClipRegion) => region.id),
			);
			nextAudioIdRef.current = deriveNextId(
				"audio",
				normalizedEditor.audioRegions.map((region) => region.id),
			);
			nextAnnotationIdRef.current = deriveNextId(
				"annotation",
				normalizedEditor.annotationRegions.map((region) => region.id),
			);
			nextAnnotationZIndexRef.current =
				normalizedEditor.annotationRegions.reduce(
					(max, region) => Math.max(max, region.zIndex),
					0,
				) + 1;

			historyPastRef.current = [];
			historyFutureRef.current = [];
			historyCurrentRef.current = null;
			applyingHistoryRef.current = false;
			syncHistoryButtons();

			setLastSavedSnapshot(
				cloneStructured(
					createProjectData(
						sourcePath,
						buildPersistedEditorState(normalizedEditor),
						project.projectId ?? null,
					),
				),
			);
			await refreshProjectLibrary();
			return true;
		},
		[
			applySessionPresentation,
			buildPersistedEditorState,
			refreshProjectLibrary,
			syncHistoryButtons,
		],
	);

	const currentProjectSnapshot = useMemo(() => {
		if (!currentSourcePath) {
			return null;
		}
		return createProjectData(
			currentSourcePath,
			currentPersistedEditorState,
			lastSavedSnapshot?.projectId ?? null,
		);
	}, [currentPersistedEditorState, currentSourcePath, lastSavedSnapshot?.projectId]);

	const syncRecordingSessionWebcam = useCallback(
		async (webcamPath: string | null, timeOffsetMs?: number) => {
			if (!currentSourcePath || !window.electronAPI.setCurrentRecordingSession) {
				return;
			}

			await window.electronAPI.setCurrentRecordingSession(
				{
					videoPath: currentSourcePath,
					webcamPath,
					timeOffsetMs:
						webcamPath && Number.isFinite(timeOffsetMs)
							? (timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS)
							: webcamPath
								? webcam.timeOffsetMs
								: DEFAULT_WEBCAM_TIME_OFFSET_MS,
				},
				{
					preserveProjectPath: Boolean(currentProjectPath),
				},
			);
		},
		[currentProjectPath, currentSourcePath, webcam.timeOffsetMs],
	);

	const handleUploadWebcam = useCallback(async () => {
		const result = await window.electronAPI.openVideoFilePicker();
		if (!result.success || !result.path) {
			return;
		}

		setWebcam((prev) => ({
			...prev,
			enabled: true,
			sourcePath: result.path ?? null,
			timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
		}));

		await syncRecordingSessionWebcam(result.path, DEFAULT_WEBCAM_TIME_OFFSET_MS);
		toast.success(t("settings.effects.webcamFootageAdded"));
	}, [syncRecordingSessionWebcam, t]);

	const handleClearWebcam = useCallback(async () => {
		setWebcam((prev) => ({
			...prev,
			enabled: false,
			sourcePath: null,
			timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
		}));

		await syncRecordingSessionWebcam(null);
		toast.success(t("settings.effects.webcamFootageRemoved"));
	}, [syncRecordingSessionWebcam, t]);

	const handleWebcamRecorded = useCallback(
		async (savedPath: string) => {
			setWebcam((prev) => ({
				...prev,
				enabled: true,
				sourcePath: savedPath,
				timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
			}));

			await syncRecordingSessionWebcam(savedPath, DEFAULT_WEBCAM_TIME_OFFSET_MS);
			toast.success(t("settings.effects.webcamFootageAdded"));
		},
		[syncRecordingSessionWebcam, t],
	);

	const handleOpenVideoFile = useCallback(async () => {
		const result = await window.electronAPI.openVideoFilePicker();
		if (result.canceled || !result.success || !result.path) return;
		await window.electronAPI.setCurrentVideoPath(result.path);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const files = Array.from(e.dataTransfer.files || []);
			if (files.length === 0) return;

			const videoFile = files.find((f) => /\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(f.name));
			const telemetryFile = files.find((f) => /\.json$/i.test(f.name));
			const audioFile = files.find((f) => /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name));

			if (videoFile) {
				let telemetryData: CursorTelemetryPoint[] | undefined;
				if (telemetryFile) {
					try {
						const text = await telemetryFile.text();
						const parsed = JSON.parse(text);
						telemetryData = Array.isArray(parsed) ? parsed : parsed?.samples;
					} catch (err) {
						console.warn("Could not parse dropped telemetry JSON:", err);
					}
				}

				if ((window.electronAPI as any)?.isWeb) {
					const { registerWebMedia } = await import("@/lib/webAdapter");
					const registered = await registerWebMedia(videoFile, videoFile.name, telemetryData);
					await window.electronAPI.setCurrentVideoPath(registered.path);
					toast.success(
						telemetryData && telemetryData.length > 0
							? "Đã nạp video và toàn bộ tọa độ chuột gốc thành công!"
							: "Đã tải video vào trình chỉnh sửa!",
					);
					return;
				}

				const filePath = (videoFile as unknown as { path?: string }).path;
				if (filePath) {
					await window.electronAPI.setCurrentVideoPath(filePath);
					return;
				}
			} else if (audioFile) {
				const nextTrackIndex =
					audioRegions.length > 0
						? Math.max(...audioRegions.map((region) => region.trackIndex ?? 0)) + 1
						: 0;

				if ((window.electronAPI as any)?.isWeb) {
					const { registerWebMedia } = await import("@/lib/webAdapter");
					const registered = await registerWebMedia(audioFile, audioFile.name);
					const audio = new Audio();
					audio.src = registered.url;
					audio.addEventListener(
						"loadedmetadata",
						() => {
							const durationMs = Math.round(audio.duration * 1000);
							const startMs = Math.round(currentTime * 1000);
							handleAudioAddedRef.current?.(
								{ start: startMs, end: startMs + (durationMs > 0 ? durationMs : 5000) },
								registered.path,
								nextTrackIndex,
							);
							toast.success("Đã thêm nhạc nền");
						},
						{ once: true },
					);
					audio.load();
					return;
				}

				const filePath = (audioFile as unknown as { path?: string }).path;
				if (filePath) {
					const audio = new Audio();
					audio.src = toFileUrl(filePath);
					audio.addEventListener(
						"loadedmetadata",
						() => {
							const durationMs = Math.round(audio.duration * 1000);
							const startMs = Math.round(currentTime * 1000);
							handleAudioAddedRef.current?.(
								{ start: startMs, end: startMs + (durationMs > 0 ? durationMs : 5000) },
								filePath,
								nextTrackIndex,
							);
							toast.success("Đã thêm nhạc nền");
						},
						{ once: true },
					);
					audio.load();
				}
			}
		},
		[audioRegions, currentTime],
	);

	useEffect(() => {
		const snapshot = buildHistorySnapshot();

		if (!historyCurrentRef.current) {
			historyCurrentRef.current = cloneSnapshot(snapshot);
			syncHistoryButtons();
			return;
		}

		if (applyingHistoryRef.current) {
			historyCurrentRef.current = cloneSnapshot(snapshot);
			applyingHistoryRef.current = false;
			syncHistoryButtons();
			return;
		}

		if (areDeepEqual(historyCurrentRef.current, snapshot)) {
			return;
		}

		historyPastRef.current.push(cloneSnapshot(historyCurrentRef.current));
		if (historyPastRef.current.length > 100) {
			historyPastRef.current.shift();
		}
		historyCurrentRef.current = cloneSnapshot(snapshot);
		historyFutureRef.current = [];
		syncHistoryButtons();
	}, [buildHistorySnapshot, cloneSnapshot, syncHistoryButtons]);

	const hasUnsavedChanges = useMemo(
		() =>
			Boolean(
				currentProjectSnapshot &&
					(!lastSavedSnapshot ||
						!areDeepEqual(currentProjectSnapshot, lastSavedSnapshot)),
			),
		[currentProjectSnapshot, lastSavedSnapshot],
	);

	useEffect(() => {
		async function loadInitialData() {
			try {
				if (smokeExportConfig.enabled && smokeExportConfig.projectPath) {
					const projectResult = await window.electronAPI.openProjectFileAtPath(
						smokeExportConfig.projectPath,
					);
					if (!projectResult.success || !projectResult.project) {
						setError(
							`Smoke export failed to load project ${smokeExportConfig.projectPath}: ${
								projectResult.error || projectResult.message || "unknown error"
							}`,
						);
						return;
					}
					const restored = await applyLoadedProject(
						projectResult.project,
						projectResult.path ?? smokeExportConfig.projectPath,
					);
					if (!restored) {
						setError(
							`Smoke export could not apply project ${smokeExportConfig.projectPath}`,
						);
						return;
					}
					setError(null);
					return;
				}

				if (!smokeExportConfig.enabled && devOpenRecordingConfig.inputPath) {
					const sourcePath = fromFileUrl(devOpenRecordingConfig.inputPath);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					const webcamSourcePath = devOpenRecordingConfig.webcamInputPath
						? fromFileUrl(devOpenRecordingConfig.webcamInputPath)
						: null;
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					pendingFreshRecordingAutoZoomPathRef.current = autoApplyFreshRecordingAutoZooms
						? sourceVideoUrl
						: null;
					setWebcam((prev) => ({
						...prev,
						enabled: Boolean(webcamSourcePath),
						sourcePath: webcamSourcePath,
						timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
					}));
					setError(null);
					return;
				}

				if (smokeExportConfig.enabled) {
					if (!smokeExportConfig.inputPath) {
						setError("Smoke export input path is missing.");
						return;
					}

					const sourcePath = fromFileUrl(smokeExportConfig.inputPath);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					const smokeWebcamSourcePath = smokeExportConfig.webcamInputPath
						? fromFileUrl(smokeExportConfig.webcamInputPath)
						: null;
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					pendingFreshRecordingAutoZoomPathRef.current = null;
					setWebcam((prev) => ({
						...prev,
						enabled: !!smokeWebcamSourcePath,
						sourcePath: smokeWebcamSourcePath,
						timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
						shadow:
							smokeExportConfig.webcamShadow === undefined
								? prev.shadow
								: smokeExportConfig.webcamShadow,
						size:
							smokeExportConfig.webcamSize === undefined
								? prev.size
								: smokeExportConfig.webcamSize,
					}));
					setError(null);
					return;
				}

				if (!window.electronAPI) {
					setError(null);
					return;
				}

				const currentProjectResult = await window.electronAPI.loadCurrentProjectFile();
				if (currentProjectResult.success && currentProjectResult.project) {
					const restored = await applyLoadedProject(
						currentProjectResult.project,
						currentProjectResult.path ?? null,
					);
					if (restored) {
						// Re-apply user preferences so stale project data does not
						// overwrite the last-used padding, aspect ratio, export
						// settings, etc. that were saved to localStorage.
						setPadding(initialEditorPreferences.padding);
						setBorderRadius(initialEditorPreferences.borderRadius);
						setAspectRatio(initialEditorPreferences.aspectRatio);
						setExportFormat(initialEditorPreferences.exportFormat);
						setMp4FrameRate(
							initialEditorPreferences.mp4FrameRate ?? DEFAULT_MP4_EXPORT_FRAME_RATE,
						);
						setExportQuality(initialEditorPreferences.exportQuality);
						setExportEncodingMode(initialEditorPreferences.exportEncodingMode);
						setExportBackendPreference(
							initialEditorPreferences.exportBackendPreference,
						);
						setExportPipelineModel(initialEditorPreferences.exportPipelineModel);
						setGifFrameRate(initialEditorPreferences.gifFrameRate);
						setGifLoop(initialEditorPreferences.gifLoop);
						setGifSizePreset(initialEditorPreferences.gifSizePreset);
						return;
					}
				}

				const sessionResult = await window.electronAPI.getCurrentRecordingSession?.();
				if (sessionResult?.success && sessionResult.session?.videoPath) {
					const sourcePath = fromFileUrl(sessionResult.session.videoPath);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					pendingFreshRecordingAutoZoomPathRef.current = autoApplyFreshRecordingAutoZooms
						? sourceVideoUrl
						: null;
					applySessionPresentation(sessionResult.session);
					setWebcam((prev) => ({
						...prev,
						enabled: Boolean(sessionResult.session?.webcamPath),
						sourcePath: sessionResult.session?.webcamPath ?? null,
						timeOffsetMs:
							sessionResult.session?.timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS,
					}));
					return;
				}

				const result = await window.electronAPI.getCurrentVideoPath();
				if (result.success && result.path) {
					const sourcePath = fromFileUrl(result.path);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					pendingFreshRecordingAutoZoomPathRef.current = null;
					applySessionPresentation(null);
					setWebcam((prev) => ({
						...prev,
						enabled: false,
						sourcePath: null,
						timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
					}));
				} else {
					setError("No video to load. Please record or select a video.");
				}
			} catch (err) {
				setError("Error loading video: " + String(err));
			} finally {
				setLoading(false);
			}
		}

		loadInitialData();
	}, [
		applyLoadedProject,
		applySessionPresentation,
		autoApplyFreshRecordingAutoZooms,
		devOpenRecordingConfig.inputPath,
		devOpenRecordingConfig.webcamInputPath,
		initialEditorPreferences,
		smokeExportConfig.enabled,
		smokeExportConfig.inputPath,
		smokeExportConfig.projectPath,
		smokeExportConfig.webcamInputPath,
		smokeExportConfig.webcamShadow,
		smokeExportConfig.webcamSize,
	]);

	useEffect(() => {
		if (!window.electronAPI?.onRecordingSessionChanged) {
			return;
		}

		return window.electronAPI.onRecordingSessionChanged(async (session) => {
			console.log("[VideoEditor] onRecordingSessionChanged received!", {
				sessionVideoPath: session?.videoPath,
				videoSourcePath: videoSourcePath,
				match: session?.videoPath === videoSourcePath,
				webcamPath: session?.webcamPath,
			});

			if (!session?.videoPath) {
				return;
			}

			const sessionNorm = session?.videoPath ? fromFileUrl(session.videoPath) : null;
			const currentNorm = videoSourcePathRef.current
				? fromFileUrl(videoSourcePathRef.current)
				: null;

			if (sessionNorm && sessionNorm !== currentNorm) {
				console.log("[VideoEditor] New recording session received, applying:", sessionNorm);
				try {
					const sourceVideoUrl = await resolveVideoUrl(sessionNorm);
					videoSourcePathRef.current = sessionNorm;
					setVideoSourcePath(sessionNorm);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					setClipRegions([]);
					clipInitializedRef.current = false;
					setZoomRegions([]);
					setPanRegions([]);
					setAudioRegions([]);
					pendingFreshRecordingAutoZoomPathRef.current = autoApplyFreshRecordingAutoZooms
						? sourceVideoUrl
						: null;
					applySessionPresentation(session);
					setError(null);
					setLoading(false);
				} catch (err) {
					console.error("Failed to load changed video session:", err);
				}
			}

			setWebcam((prev) => ({
				...prev,
				enabled: Boolean(session.webcamPath),
				sourcePath: session.webcamPath ?? null,
				timeOffsetMs: session.webcamPath
					? (session.timeOffsetMs ?? prev.timeOffsetMs)
					: DEFAULT_WEBCAM_TIME_OFFSET_MS,
			}));
		});
	}, [applySessionPresentation, videoSourcePath]);

	useEffect(() => {
		let cancelled = false;
		if (!webcam.sourcePath) {
			setResolvedWebcamVideoUrl(null);
			return;
		}
		void resolveVideoUrl(webcam.sourcePath).then((url) => {
			if (!cancelled) setResolvedWebcamVideoUrl(url);
		});
		return () => {
			cancelled = true;
		};
	}, [webcam.sourcePath]);

	useEffect(() => {
		if (!autoApplyFreshRecordingAutoZooms) {
			pendingFreshRecordingAutoZoomPathRef.current = null;
		}
	}, [autoApplyFreshRecordingAutoZooms]);

	useEffect(() => {
		saveEditorPreferences({
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			autoApplyFreshRecordingAutoZooms,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			borderRadius,
			padding,
			frame,
			webcam,
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
		});
	}, [
		wallpaper,
		shadowIntensity,
		backgroundBlur,
		zoomMotionBlur,
		zoomMotionBlurTuning,
		zoomTemporalMotionBlur,
		zoomMotionBlurSampleCount,
		zoomMotionBlurShutterFraction,
		autoApplyFreshRecordingAutoZooms,
		connectZooms,
		zoomInDurationMs,
		zoomInOverlapMs,
		zoomOutDurationMs,
		connectedZoomGapMs,
		connectedZoomDurationMs,
		zoomInEasing,
		zoomOutEasing,
		connectedZoomEasing,
		showCursor,
		loopCursor,
		cursorStyle,
		cursorSize,
		cursorSmoothing,
		cursorSpringStiffnessMultiplier,
		cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier,
		cameraSpringStiffnessMultiplier,
		cameraSpringDampingMultiplier,
		cameraSpringMassMultiplier,
		cursorMotionBlur,
		cursorClickBounce,
		cursorClickBounceDuration,
		cursorSway,
		borderRadius,
		padding,
		frame,
		webcam,
		aspectRatio,
		exportEncodingMode,
		exportBackendPreference,
		exportPipelineModel,
		exportQuality,
		mp4FrameRate,
		exportFormat,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
	]);

	const saveProject = useCallback(
		async (forceSaveAs: boolean, options?: SaveProjectOptions) => {
			clearPendingProjectAutosave();
			return queueProjectSave(async () => {
				if (!currentSourcePath) {
					if (!options?.silent) {
						toast.error("Chưa tải video nào");
					}
					return false;
				}

				const shouldCaptureThumbnail = options?.captureThumbnail ?? true;
				const shouldRefreshLibrary = options?.refreshLibraryAfterSave ?? true;
				const shouldRemountPreview = options?.remountPreviewAfterSave ?? true;

				try {
					const projectData =
						currentProjectSnapshot?.videoPath === currentSourcePath
							? currentProjectSnapshot
							: createProjectData(
									currentSourcePath,
									currentPersistedEditorState,
									lastSavedSnapshot?.projectId ?? null,
								);

					const fileNameBase =
						currentSourcePath
							.split(/[\\/]/)
							.pop()
							?.replace(/\.[^.]+$/, "") || `project-${Date.now()}`;
					let targetProjectPath = forceSaveAs
						? undefined
						: (currentProjectPath ?? undefined);

					if (!forceSaveAs && !targetProjectPath) {
						const activeProjectResult =
							await window.electronAPI.loadCurrentProjectFile();
						if (activeProjectResult.success && activeProjectResult.path) {
							targetProjectPath = activeProjectResult.path;
							setCurrentProjectPath(activeProjectResult.path);
						}
					}

					const thumbnailDataUrl = shouldCaptureThumbnail
						? await captureProjectThumbnail()
						: undefined;

					const result = await window.electronAPI.saveProjectFile(
						projectData,
						fileNameBase,
						targetProjectPath,
						thumbnailDataUrl,
					);

					if (result.canceled) {
						if (!options?.silent) {
							toast.info("Đã hủy lưu dự án");
						}
						return false;
					}

					if (!result.success) {
						if (!options?.silent) {
							toast.error(result.message || "Lưu dự án thất bại");
						}
						return false;
					}

					if (result.path) {
						setCurrentProjectPath(result.path);
					}
					setLastSavedSnapshot(
						cloneStructured(
							createProjectData(
								projectData.videoPath,
								projectData.editor,
								result.projectId ?? projectData.projectId ?? null,
							),
						),
					);
					if (shouldRefreshLibrary) {
						await refreshProjectLibrary();
					}

					if (!options?.silent) {
						toast.success(`Đã lưu dự án vào ${result.path}`);
					}
					return true;
				} finally {
					if (shouldRemountPreview) {
						remountPreview();
					}
				}
			});
		},
		[
			captureProjectThumbnail,
			clearPendingProjectAutosave,
			currentSourcePath,
			currentProjectPath,
			currentProjectSnapshot,
			currentPersistedEditorState,
			lastSavedSnapshot?.projectId,
			queueProjectSave,
			refreshProjectLibrary,
			remountPreview,
		],
	);

	useEffect(() => {
		window.electronAPI?.setHasUnsavedChanges?.(hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		const cleanup = window.electronAPI?.onRequestSaveBeforeClose?.(async () => {
			return saveProject(false);
		});

		return () => cleanup?.();
	}, [saveProject]);

	const handleSaveProject = useCallback(async () => {
		await saveProject(false);
	}, [saveProject]);

	const handleSaveProjectAs = useCallback(async () => {
		const saved = await saveProject(true);
		if (saved) {
			setProjectBrowserOpen(false);
		}
	}, [saveProject]);

	useEffect(() => {
		if (!currentProjectPath || !hasUnsavedChanges) {
			clearPendingProjectAutosave();
			return;
		}

		projectAutosaveTimeoutRef.current = window.setTimeout(() => {
			projectAutosaveTimeoutRef.current = null;
			void saveProject(false, {
				silent: true,
				remountPreviewAfterSave: false,
				refreshLibraryAfterSave: false,
				captureThumbnail: false,
			});
		}, PROJECT_AUTOSAVE_DELAY_MS);

		return () => {
			clearPendingProjectAutosave();
		};
	}, [clearPendingProjectAutosave, currentProjectPath, hasUnsavedChanges, saveProject]);

	/**
	 * Saves the current project directly into the projects library under a chosen name.
	 */
	const saveProjectWithName = useCallback(
		async (projectName: string) => {
			const trimmedProjectName = projectName.trim();
			if (!trimmedProjectName) {
				toast.error("Tên dự án không được để trống");
				return false;
			}

			if (!currentSourcePath) {
				toast.error("Chưa tải video nào");
				return false;
			}

			try {
				const projectData =
					currentProjectSnapshot?.videoPath === currentSourcePath
						? currentProjectSnapshot
						: createProjectData(
								currentSourcePath,
								currentPersistedEditorState,
								lastSavedSnapshot?.projectId ?? null,
							);
				const thumbnailDataUrl = await captureProjectThumbnail();
				const result = await window.electronAPI.saveProjectFileNamed(
					projectData,
					trimmedProjectName,
					thumbnailDataUrl,
				);

				if (result.canceled) {
					toast.info("Đã hủy lưu dự án");
					return false;
				}

				if (!result.success) {
					toast.error(result.message || "Lưu dự án thất bại");
					return false;
				}

				if (result.path) {
					setCurrentProjectPath(result.path);
				}
				setLastSavedSnapshot(
					cloneStructured(
						createProjectData(
							projectData.videoPath,
							projectData.editor,
							result.projectId ?? projectData.projectId ?? null,
						),
					),
				);
				await refreshProjectLibrary();
				toast.success(result.path ? `Đã lưu dự án vào ${result.path}` : "Đã lưu dự án");
				return true;
			} finally {
				remountPreview();
			}
		},
		[
			captureProjectThumbnail,
			currentPersistedEditorState,
			currentProjectSnapshot,
			currentSourcePath,
			lastSavedSnapshot?.projectId,
			refreshProjectLibrary,
			remountPreview,
		],
	);

	/**
	 * Resets the inline project-name editor back to the current saved display name.
	 */
	const closeProjectNameEditor = useCallback(() => {
		setProjectNameDraft(effectiveProjectDisplayName);
		setIsEditingProjectName(false);
	}, [effectiveProjectDisplayName]);

	/**
	 * Commits the inline project-name editor and persists the project under that name.
	 */
	const handleProjectNameSubmit = useCallback(
		async (event?: React.FormEvent<HTMLFormElement>) => {
			event?.preventDefault();
			const trimmedProjectName = projectNameDraft.trim();
			if (!trimmedProjectName) {
				closeProjectNameEditor();
				return;
			}

			setIsSavingProjectName(true);
			let saved = false;
			try {
				saved = await saveProjectWithName(trimmedProjectName);
			} catch (error) {
				toast.error(getErrorMessage(error));
			} finally {
				setIsSavingProjectName(false);
			}

			if (saved) {
				setIsEditingProjectName(false);
				return;
			}

			projectNameInputRef.current?.focus();
			projectNameInputRef.current?.select();
		},
		[closeProjectNameEditor, projectNameDraft, saveProjectWithName],
	);

	const handleOpenProjectFromLibrary = useCallback(
		async (projectPath: string) => {
			const result = await window.electronAPI.openProjectFileAtPath(projectPath);

			if (result.canceled) {
				return;
			}

			if (!result.success) {
				toast.error(result.message || "Tải dự án thất bại");
				return;
			}

			const restored = await applyLoadedProject(result.project, result.path ?? null);
			if (!restored) {
				toast.error("Định dạng tệp dự án không hợp lệ");
				return;
			}

			setProjectBrowserOpen(false);
			await refreshProjectLibrary();
			toast.success(`Đã tải dự án từ ${result.path}`);
		},
		[applyLoadedProject, refreshProjectLibrary],
	);

	const handleOpenProjectBrowser = useCallback(async () => {
		if (projectBrowserOpen) {
			setProjectBrowserOpen(false);
			return;
		}

		void (async () => {
			try {
				const thumb = await captureProjectThumbnail();
				if (thumb) {
					setCurrentThumbnailUrl(thumb);
				}
			} catch {
				// Ignore
			}
		})();

		await refreshProjectLibrary();
		setProjectBrowserOpen(true);
	}, [projectBrowserOpen, refreshProjectLibrary, captureProjectThumbnail]);

	useEffect(() => {
		let isCancelled = false;
		const timer = setTimeout(() => {
			void (async () => {
				try {
					const thumb = await captureProjectThumbnail();
					if (!isCancelled && thumb) {
						setCurrentThumbnailUrl(thumb);
					}
				} catch {
					// Ignore
				}
			})();
		}, 800);

		return () => {
			isCancelled = true;
			clearTimeout(timer);
		};
	}, [captureProjectThumbnail, videoPath]);

	const handleStartNewRecording = useCallback(async () => {
		if (typeof window !== "undefined" && window.electronAPI?.openRecorder) {
			try {
				await window.electronAPI.openRecorder({ minimizeEditor: true });
			} catch (error) {
				console.error("Failed to open screen recorder:", error);
				toast.error(t("launch.recording.launchError", "Failed to open screen recorder"));
			}
		}
	}, [t]);

	useEffect(() => {
		const removeLoadListener = window.electronAPI?.onMenuLoadProject?.(() => {
			void handleOpenProjectBrowser();
		});
		const removeSaveListener = window.electronAPI?.onMenuSaveProject?.(handleSaveProject);
		const removeSaveAsListener = window.electronAPI?.onMenuSaveProjectAs?.(handleSaveProjectAs);

		return () => {
			removeLoadListener?.();
			removeSaveListener?.();
			removeSaveAsListener?.();
		};
	}, [handleOpenProjectBrowser, handleSaveProject, handleSaveProjectAs]);

	useEffect(() => {
		let mounted = true;
		let retryAttempts = 0;

		async function loadCursorTelemetry() {
			if (!videoPath || !videoSourcePath) {
				if (mounted) {
					setCursorTelemetry([]);
					setCursorTelemetrySourcePath(null);
				}
				return;
			}

			try {
				const result = await window.electronAPI.getCursorTelemetry(videoSourcePath);
				if (mounted) {
					const samples = result.success ? result.samples : [];
					setCursorTelemetry(samples);
					setCursorTelemetrySourcePath(videoSourcePath);

					const shouldRetryFreshRecordingTelemetry =
						pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
						autoSuggestedVideoPathRef.current !== videoPath &&
						retryAttempts < 12;

					if (shouldRetryFreshRecordingTelemetry) {
						retryAttempts += 1;
						pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
							pendingTelemetryRetryTimeoutRef.current = null;
							if (mounted) {
								void loadCursorTelemetry();
							}
						}, 350);
					}
				}
			} catch (telemetryError) {
				console.warn("Unable to load cursor telemetry:", telemetryError);
				if (mounted) {
					setCursorTelemetry([]);
					setCursorTelemetrySourcePath(videoSourcePath);
					if (
						pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
						autoSuggestedVideoPathRef.current !== videoPath &&
						retryAttempts < 12
					) {
						retryAttempts += 1;
						pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
							pendingTelemetryRetryTimeoutRef.current = null;
							if (mounted) {
								void loadCursorTelemetry();
							}
						}, 350);
					}
				}
			}
		}

		if (pendingTelemetryRetryTimeoutRef.current !== null) {
			window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
			pendingTelemetryRetryTimeoutRef.current = null;
		}

		loadCursorTelemetry();

		return () => {
			mounted = false;
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
				pendingTelemetryRetryTimeoutRef.current = null;
			}
		};
	}, [videoPath, videoSourcePath]);

	const normalizedCursorTelemetry = useMemo(() => {
		if (cursorTelemetry.length === 0) {
			return [] as CursorTelemetryPoint[];
		}

		const totalMs = Math.max(0, Math.round(duration * 1000));
		return normalizeCursorTelemetry(
			cursorTelemetry,
			totalMs > 0 ? totalMs : Number.MAX_SAFE_INTEGER,
		);
	}, [cursorTelemetry, duration]);

	const displayedTimelineWindow = useMemo(() => {
		const totalMs = Math.max(0, Math.round(duration * 1000));
		return getDisplayedTimelineWindowMs(totalMs, trimRegions);
	}, [duration, trimRegions]);

	const effectiveCursorTelemetry = useMemo(() => {
		if (!loopCursor) {
			return normalizedCursorTelemetry;
		}

		if (
			normalizedCursorTelemetry.length < 2 ||
			displayedTimelineWindow.endMs <= displayedTimelineWindow.startMs
		) {
			return normalizedCursorTelemetry;
		}

		return buildLoopedCursorTelemetry(
			normalizedCursorTelemetry,
			displayedTimelineWindow.endMs,
			displayedTimelineWindow.startMs,
		);
	}, [loopCursor, normalizedCursorTelemetry, displayedTimelineWindow]);

	// Initialize a full-track clip when duration is first known
	const clipInitializedRef = useRef(false);
	const autoFullTrackClipIdRef = useRef<string | null>(null);
	const autoFullTrackClipEndMsRef = useRef<number | null>(null);
	useEffect(() => {
		const totalMs = Math.round(duration * 1000);
		if (totalMs <= 0) return;
		if (!clipInitializedRef.current) {
			if (clipRegions.length === 0) {
				const nextClipRegions =
					trimRegions.length > 0
						? trimsToClips(trimRegions, totalMs)
						: (() => {
								const id = `clip-${nextClipIdRef.current++}`;
								autoFullTrackClipIdRef.current = id;
								autoFullTrackClipEndMsRef.current = totalMs;
								return [{ id, startMs: 0, endMs: totalMs, speed: 1 }];
							})();

				if (trimRegions.length > 0) {
					nextClipIdRef.current = deriveNextId(
						"clip",
						nextClipRegions.map((region) => region.id),
					);
				}

				setClipRegions(nextClipRegions);
				if (speedRegions.length > 0) {
					// Legacy speed regions no longer have dedicated editing surfaces.
					// Clear them during clip bootstrap so old projects do not keep
					// hidden playback changes that users cannot inspect or edit.
					setSpeedRegions([]);
				}
			}
			clipInitializedRef.current = true;
			return;
		}

		const extendedClipRegions = extendAutoFullTrackClip(
			clipRegions,
			autoFullTrackClipIdRef.current,
			autoFullTrackClipEndMsRef.current,
			totalMs,
		);
		if (!extendedClipRegions) return;

		autoFullTrackClipEndMsRef.current = totalMs;
		setClipRegions(extendedClipRegions);
	}, [duration, clipRegions, trimRegions, speedRegions]);

	// Derive trimRegions from clipRegions so export/playback pipelines stay unchanged
	useEffect(() => {
		const totalMs = Math.round(duration * 1000);
		if (totalMs <= 0 || clipRegions.length === 0) return;
		setTrimRegions(clipsToTrims(clipRegions, totalMs));
	}, [clipRegions, duration]);

	const mapTimelineTimeToSourceTime = useCallback(
		(timeMs: number) => resolveTimelineTimeToSourceTime(timeMs, clipRegions),
		[clipRegions],
	);

	const mapSourceTimeToTimelineTime = useCallback(
		(timeMs: number) => resolveSourceTimeToTimelineTime(timeMs, clipRegions),
		[clipRegions],
	);

	// Regions switched off with the zoom track toggle are ignored by preview + export.
	const manualZoomRegionsInSourceTime = useMemo<ZoomRegion[]>(
		() =>
			zoomRegions
				.filter((region) => !region.disabled)
				.map((region) => ({
					...region,
					startMs: mapTimelineTimeToSourceTime(region.startMs),
					endMs: mapTimelineTimeToSourceTime(region.endMs),
				})),
		[zoomRegions, mapTimelineTimeToSourceTime],
	);

	const effectivePanRegionsInSourceTime = useMemo<PanRegion[]>(
		() =>
			panRegions
				.filter((region) => !region.disabled)
				.map((region) => ({
					...region,
					startMs: mapTimelineTimeToSourceTime(region.startMs),
					endMs: mapTimelineTimeToSourceTime(region.endMs),
				})),
		[panRegions, mapTimelineTimeToSourceTime],
	);

	const smartCameraZoomRegions = useMemo<ZoomRegion[]>(() => {
		if (!smartCameraEnabled || effectiveCursorTelemetry.length === 0 || duration <= 0)
			return [];
		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: effectiveCursorTelemetry,
			totalMs: duration * 1000,
			defaultDurationMs: 400,
			// Zooms placed by the user win: Smart Camera never adds a hidden zoom that
			// overlaps one (overlapping zooms fought over the camera → jumps).
			reservedSpans: manualZoomRegionsInSourceTime.map((region) => ({
				start: region.startMs,
				end: region.endMs,
			})),
		});
		return result.suggestions.map((s, idx) => ({
			id: `smart-zoom-${idx}`,
			startMs: s.start,
			endMs: s.end,
			depth: 3,
			// Explicit scale so preview AND export both use the Smart Camera scale.
			scale: smartCameraScale,
			focus: s.focus,
			mode: "auto",
		}));
	}, [
		smartCameraEnabled,
		smartCameraScale,
		effectiveCursorTelemetry,
		duration,
		manualZoomRegionsInSourceTime,
	]);

	const effectiveZoomRegions = useMemo<ZoomRegion[]>(
		() => [...smartCameraZoomRegions, ...manualZoomRegionsInSourceTime],
		[smartCameraZoomRegions, manualZoomRegionsInSourceTime],
	);

	const timelinePlayheadTime = useMemo(
		() => mapSourceTimeToTimelineTime(currentTime * 1000) / 1000,
		[currentTime, mapSourceTimeToTimelineTime],
	);
	const timelineDuration = useMemo(
		() => getTimelineDurationMs(clipRegions, duration * 1000) / 1000,
		[clipRegions, duration],
	);

	// Merge clip speeds into speed regions so playback + export respect per-clip speed
	const effectiveSpeedRegions = useMemo<SpeedRegion[]>(() => {
		const clipDerived: SpeedRegion[] = clipRegions
			.filter((clip) => clip.speed !== 1)
			.map((clip) => ({
				id: `clip-speed-${clip.id}`,
				startMs: clip.startMs,
				endMs: getClipSourceEndMs(clip),
				speed: clip.speed as SpeedRegion["speed"],
			}));
		if (clipDerived.length === 0) return speedRegions;
		const result = [...speedRegions];
		for (const cs of clipDerived) {
			const overlaps = speedRegions.some(
				(sr) => sr.endMs > cs.startMs && sr.startMs < cs.endMs,
			);
			if (!overlaps) {
				result.push(cs);
			}
		}
		return result;
	}, [clipRegions, speedRegions]);
	const audio = useVideoEditorAudio({
		currentSourcePath,
		selectedClipId,
		clipRegions,
		audioRegions,
		effectiveSpeedRegions,
		sourceAudioTrackSettingsByClip,
		setSourceAudioTrackSettingsByClip,
		defaultSourceAudioTrackSettings,
		setDefaultSourceAudioTrackSettings,
		currentTime,
		timelineTime: timelinePlayheadTime,
		duration,
		isPlaying,
		previewVolume,
		summarizeErrorMessage,
		onSourceFallbackLoadError: (error) => {
			toast.warning(
				`Could not load companion audio source: ${summarizeErrorMessage(getErrorMessage(error))}`,
				{ duration: 10000 },
			);
		},
	});

	function togglePlayPause() {
		const playback = videoPlaybackRef.current;
		const video = playback?.video;
		if (!playback || !video) return;

		if (!video.paused && !video.ended) {
			playback.pause();
		} else {
			playback.play().catch((err) => console.error("Video play failed:", err));
		}
	}

	const handleAutoSuggestZoomsConsumed = useCallback(() => {
		setAutoSuggestZoomsTrigger(0);
	}, []);

	const handleSeek = useCallback(
		(time: number, options: { pause?: boolean } = {}) => {
			const playback = videoPlaybackRef.current;
			const video = playback?.video;
			if (!video) return;

			if (options.pause && !video.paused) {
				playback?.pause();
			}

			video.currentTime = mapTimelineTimeToSourceTime(time * 1000) / 1000;
		},
		[mapTimelineTimeToSourceTime],
	);

	const savedPlayheadTimeRef = useRef<number | null>(null);

	const handleHoverPreview = useCallback(
		(time: number | null) => {
			const playback = videoPlaybackRef.current;
			const video = playback?.video;
			if (!video) return;

			if (time !== null) {
				if (savedPlayheadTimeRef.current === null) {
					savedPlayheadTimeRef.current = video.currentTime;
				}
				const sourceTime = mapTimelineTimeToSourceTime(time * 1000) / 1000;
				video.currentTime = sourceTime;
			} else {
				if (savedPlayheadTimeRef.current !== null) {
					video.currentTime = savedPlayheadTimeRef.current;
					savedPlayheadTimeRef.current = null;
				}
			}
		},
		[mapTimelineTimeToSourceTime],
	);

	const handleTimelineSeek = useCallback(
		(time: number) => {
			savedPlayheadTimeRef.current = null;
			handleSeek(time, { pause: true });
		},
		[handleSeek],
	);

	const handleSelectZoom = useCallback((id: string | null) => {
		setSelectedZoomId(id);
		if (id) {
			setActiveEffectSection("zoom");
			setSelectedPanId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		} else {
			setActiveEffectSection((s) => (s === "zoom" ? "scene" : s));
		}
	}, []);

	const handleSelectAnnotation = useCallback((id: string | null) => {
		setSelectedAnnotationId(id);
		if (id) {
			setActiveEffectSection("annotation");
			setSelectedZoomId(null);
			setSelectedPanId(null);
			setSelectedAudioId(null);
		}
	}, []);

	const handleZoomAdded = useCallback(
		(span: Span) => {
			setSmartCameraEnabled(false);
			const id = `zoom-${nextZoomIdRef.current++}`;
			const defaultDepth: ZoomDepth = 2;
			// Aim the new zoom at the click inside it (or the cursor) instead of the
			// screen centre, so it is correct even in Manual / Classic mode.
			const focusFromCursor = resolveZoomFocusForSpan(
				normalizedCursorTelemetry,
				mapTimelineTimeToSourceTime(span.start),
				mapTimelineTimeToSourceTime(span.end),
			);
			const newRegion: ZoomRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				depth: defaultDepth,
				focus: clampFocusToDepth(focusFromCursor ?? { cx: 0.5, cy: 0.5 }, defaultDepth),
				mode: "auto",
			};
			if (videoPath && pendingFreshRecordingAutoZoomPathRef.current === videoPath) {
				autoSuggestedVideoPathRef.current = videoPath;
				pendingFreshRecordingAutoZoomPathRef.current = null;
			}
			setZoomRegions((prev) => [
				...prev.map(({ disabled: _disabled, ...region }) => region),
				newRegion,
			]);
			const panId = `pan-${nextPanIdRef.current++}`;
			const newPanRegion: PanRegion = {
				id: panId,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
			};
			setPanRegions((prev) => [
				...prev.map(({ disabled: _disabled, ...region }) => region),
				newPanRegion,
			]);
			setSelectedZoomId(id);
			setSelectedPanId(null);
			setSelectedAnnotationId(null);
			extensionHost.emitEvent({
				type: "timeline:region-added",
				data: { id, startMs: newRegion.startMs, endMs: newRegion.endMs },
			});
		},
		[videoPath, normalizedCursorTelemetry, mapTimelineTimeToSourceTime],
	);

	const handleZoomSuggested = useCallback(
		(span: Span, focus: ZoomFocus) => {
			const id = `zoom-${nextZoomIdRef.current++}`;
			const newRegion: ZoomRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				depth: DEFAULT_AUTO_ZOOM_DEPTH,
				focus: clampFocusToDepth(focus, DEFAULT_AUTO_ZOOM_DEPTH),
				mode: "auto",
			};
			if (videoPath && pendingFreshRecordingAutoZoomPathRef.current === videoPath) {
				autoSuggestedVideoPathRef.current = videoPath;
				pendingFreshRecordingAutoZoomPathRef.current = null;
			}
			setZoomRegions((prev) => [...prev, newRegion]);
			const panId = `pan-${nextPanIdRef.current++}`;
			const newPanRegion: PanRegion = {
				id: panId,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
			};
			setPanRegions((prev) => [...prev, newPanRegion]);
			// Don't auto-select suggested zooms — they follow cursor and don't need user interaction
			extensionHost.emitEvent({
				type: "timeline:region-added",
				data: { id, startMs: newRegion.startMs, endMs: newRegion.endMs },
			});
		},
		[videoPath],
	);

	useEffect(() => {
		if (
			!videoPath ||
			loading ||
			!isPreviewReady ||
			duration <= 0 ||
			zoomRegions.length > 0 ||
			normalizedCursorTelemetry.length < 2
		) {
			if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
				pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			}
			return;
		}

		if (pendingFreshRecordingAutoZoomPathRef.current !== videoPath) {
			return;
		}

		if (autoSuggestedVideoPathRef.current === videoPath) {
			pendingFreshRecordingAutoZoomPathRef.current = null;
			return;
		}

		const telemetryPointCount = cursorTelemetry.length;
		if (pendingFreshRecordingAutoSuggestTelemetryCountRef.current === telemetryPointCount) {
			return;
		}

		pendingFreshRecordingAutoSuggestTelemetryCountRef.current = telemetryPointCount;

		if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
		}

		pendingFreshRecordingAutoSuggestTimeoutRef.current = window.setTimeout(() => {
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			if (
				pendingFreshRecordingAutoZoomPathRef.current !== videoPath ||
				autoSuggestedVideoPathRef.current === videoPath ||
				zoomRegions.length > 0
			) {
				return;
			}

			setAutoSuggestZoomsTrigger((value) => value + 1);
		}, 500);
	}, [
		videoPath,
		loading,
		isPreviewReady,
		duration,
		cursorTelemetry.length,
		normalizedCursorTelemetry,
		zoomRegions,
	]);

	// Zoom track toggle: ON while at least one manual zoom is active (not all disabled).
	const zoomsEnabled = useMemo(
		() => zoomRegions.length === 0 || zoomRegions.some((region) => !region.disabled),
		[zoomRegions],
	);

	const handleSmartCameraEnabledChange = useCallback((enabled: boolean) => {
		setSmartCameraEnabled(enabled);
	}, []);

	const handleToggleZooms = useCallback(() => {
		setZoomRegions((prev) => {
			const turnOff = prev.some((region) => !region.disabled);
			return prev.map(({ disabled: _disabled, ...region }) =>
				turnOff ? { ...region, disabled: true } : region,
			);
		});
	}, []);

	const handleZoomSpanChange = useCallback((id: string, span: Span) => {
		setZoomRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
		setZoomRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							focus: clampFocusToDepth(focus, region.depth),
						}
					: region,
			),
		);
	}, []);

	const handleZoomDepthChange = useCallback(
		(depth: ZoomDepth) => {
			if (!selectedZoomId) return;
			setZoomRegions((prev) =>
				prev.map((region) =>
					region.id === selectedZoomId
						? {
								...region,
								depth,
								focus: clampFocusToDepth(region.focus, depth),
							}
						: region,
				),
			);
		},
		[selectedZoomId],
	);

	const handleZoomModeChange = useCallback(
		(mode: ZoomMode) => {
			if (!selectedZoomId) return;
			setZoomRegions((prev) =>
				prev.map((region) => (region.id === selectedZoomId ? { ...region, mode } : region)),
			);
		},
		[selectedZoomId],
	);

	const handleZoomPanChange = useCallback(
		(pan: boolean) => {
			if (!selectedZoomId) return;
			setZoomRegions((prev) =>
				prev.map((region) => (region.id === selectedZoomId ? { ...region, pan } : region)),
			);
		},
		[selectedZoomId],
	);

	const handleZoomDelete = useCallback(
		(id: string) => {
			setZoomRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedZoomId === id) {
				setSelectedZoomId(null);
			}
			extensionHost.emitEvent({ type: "timeline:region-removed", data: { id } });
		},
		[selectedZoomId],
	);

	const handleZoomDuplicate = useCallback(
		(id: string, span?: Span) => {
			const target = zoomRegions.find((r) => r.id === id);
			if (!target) return;
			const durationMs = target.endMs - target.startMs;
			const newStartMs = span ? Math.round(span.start) : target.endMs + 50;
			const maxMs = Math.round(duration * 1000);
			const newEndMs = span ? Math.round(span.end) : Math.min(newStartMs + durationMs, maxMs);
			const newId = `zoom-${nextZoomIdRef.current++}`;
			const duplicated: ZoomRegion = {
				...target,
				id: newId,
				startMs: newStartMs,
				endMs: newEndMs,
			};
			setZoomRegions((prev) => [...prev, duplicated]);
			setSelectedZoomId(newId);
			extensionHost.emitEvent({
				type: "timeline:region-added",
				data: { id: newId, startMs: duplicated.startMs, endMs: duplicated.endMs },
			});
		},
		[zoomRegions, duration],
	);

	const pansEnabled = useMemo(
		() => panRegions.length === 0 || panRegions.some((region) => !region.disabled),
		[panRegions],
	);

	const handleTogglePans = useCallback(() => {
		setPanRegions((prev) => {
			const turnOff = prev.some((region) => !region.disabled);
			return prev.map(({ disabled: _disabled, ...region }) =>
				turnOff ? { ...region, disabled: true } : region,
			);
		});
	}, []);

	const handleSelectPan = useCallback((id: string | null) => {
		setSelectedPanId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		}
	}, []);

	const handlePanAdded = useCallback((span: Span) => {
		const id = `pan-${nextPanIdRef.current++}`;
		const newRegion: PanRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
		};
		setPanRegions((prev) => [
			...prev.map(({ disabled: _disabled, ...region }) => region),
			newRegion,
		]);
		setSelectedPanId(id);
		setSelectedZoomId(null);
		setSelectedAnnotationId(null);
	}, []);

	const handlePanSpanChange = useCallback((id: string, span: Span) => {
		setPanRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handlePanDelete = useCallback(
		(id: string) => {
			setPanRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedPanId === id) {
				setSelectedPanId(null);
			}
		},
		[selectedPanId],
	);

	const handlePanDuplicate = useCallback(
		(id: string, span?: Span) => {
			const target = panRegions.find((r) => r.id === id);
			if (!target) return;
			const durationMs = target.endMs - target.startMs;
			const newStartMs = span ? Math.round(span.start) : target.endMs + 50;
			const maxMs = Math.round(duration * 1000);
			const newEndMs = span ? Math.round(span.end) : Math.min(newStartMs + durationMs, maxMs);
			const newId = `pan-${nextPanIdRef.current++}`;
			const duplicated: PanRegion = {
				...target,
				id: newId,
				startMs: newStartMs,
				endMs: newEndMs,
			};
			setPanRegions((prev) => [...prev, duplicated]);
			setSelectedPanId(newId);
		},
		[panRegions, duration],
	);

	const handlePanSpeedChange = useCallback((id: string, speed: PanSpeed) => {
		setPanRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, speed } : region)),
		);
	}, []);

	const handleSelectClip = useCallback((id: string | null) => {
		setSelectedClipId(id);
		if (id) {
			setActiveEffectSection("clip");
			setSelectedZoomId(null);
			setSelectedPanId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		} else {
			setActiveEffectSection((s) => (s === "clip" ? "scene" : s));
		}
	}, []);

	const handleClipSplit = useCallback(
		(splitMs: number) => {
			setClipRegions((prev) => {
				const target = prev.find((c) => splitMs > c.startMs && splitMs < c.endMs);
				if (!target) return prev;
				const leftId = `clip-${nextClipIdRef.current++}`;
				const rightId = `clip-${nextClipIdRef.current++}`;
				const left: ClipRegion = {
					id: leftId,
					startMs: target.startMs,
					endMs: Math.round(splitMs),
					speed: target.speed,
					muted: target.muted,
				};
				const right: ClipRegion = {
					id: rightId,
					startMs: Math.round(splitMs),
					endMs: target.endMs,
					speed: target.speed,
					muted: target.muted,
				};
				if (selectedClipId === target.id) {
					setSelectedClipId(leftId);
				}
				return prev.flatMap((c) => (c.id === target.id ? [left, right] : [c]));
			});
		},
		[selectedClipId],
	);

	const handleClipSpanChange = useCallback(
		(id: string, span: Span) => {
			const oldClip = clipRegions.find((c) => c.id === id);
			const newStart = Math.round(span.start);
			const newEnd = Math.round(span.end);
			const removedSegments = oldClip
				? [
						...(newStart > oldClip.startMs
							? [{ startMs: oldClip.startMs, endMs: newStart }]
							: []),
						...(newEnd < oldClip.endMs
							? [{ startMs: newEnd, endMs: oldClip.endMs }]
							: []),
					]
				: [];

			if (oldClip) {
				const startDelta = newStart - oldClip.startMs;
				const endDelta = newEnd - oldClip.endMs;
				const isMove = Math.abs(startDelta - endDelta) < 1 && Math.abs(startDelta) > 0;

				if (isMove) {
					const delta = startDelta;
					setZoomRegions((prev) =>
						prev.map((zoom) => {
							const overlaps =
								zoom.startMs < oldClip.endMs && zoom.endMs > oldClip.startMs;
							if (overlaps) {
								return {
									...zoom,
									startMs: zoom.startMs + delta,
									endMs: zoom.endMs + delta,
								};
							}
							return zoom;
						}),
					);
				}
			}

			if (removedSegments.length > 0) {
				const removeTrimmedRegions = <T extends { startMs: number; endMs: number }>(
					regions: T[],
				): T[] =>
					regions.filter(
						(region) =>
							!removedSegments.some(
								(segment) =>
									region.startMs < segment.endMs &&
									region.endMs > segment.startMs,
							),
					);
				setZoomRegions((prev) => removeTrimmedRegions(prev));
				setAnnotationRegions((prev) => removeTrimmedRegions(prev));
				setSpeedRegions((prev) => removeTrimmedRegions(prev));
				setAudioRegions((prev) => removeTrimmedRegions(prev));
			}

			setClipRegions((prev) =>
				prev.map((clip) =>
					clip.id === id ? { ...clip, startMs: newStart, endMs: newEnd } : clip,
				),
			);
		},
		[clipRegions],
	);

	const handleClipSpeedChange = useCallback(
		(speed: number) => {
			if (!selectedClipId) return;
			if (!Number.isFinite(speed) || speed <= 0) {
				return;
			}
			const clip = clipRegions.find((c) => c.id === selectedClipId);
			if (!clip) return;
			const oldSpeed = Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;
			const sourceDurationMs = (clip.endMs - clip.startMs) * oldSpeed;
			const newEndMs = Math.round(clip.startMs + sourceDurationMs / speed);
			const scaleFactor = oldSpeed / speed;

			setClipRegions((prev) =>
				prev.map((c) => (c.id === selectedClipId ? { ...c, speed, endMs: newEndMs } : c)),
			);
			// Scale zoom regions that lie within this clip proportionally
			setZoomRegions((prev) =>
				prev.map((zoom) => {
					if (zoom.startMs < clip.startMs || zoom.startMs >= clip.endMs) return zoom;
					return {
						...zoom,
						startMs: Math.round(
							clip.startMs + (zoom.startMs - clip.startMs) * scaleFactor,
						),
						endMs: Math.round(clip.startMs + (zoom.endMs - clip.startMs) * scaleFactor),
					};
				}),
			);
		},
		[selectedClipId, clipRegions],
	);

	const handleClipMutedChange = useCallback(
		(muted: boolean) => {
			if (!selectedClipId) return;
			setClipRegions((prev) =>
				prev.map((clip) => (clip.id === selectedClipId ? { ...clip, muted } : clip)),
			);
		},
		[selectedClipId],
	);

	const handleClipShowSourceAudioChange = useCallback(
		(showSourceAudio: boolean) => {
			if (!selectedClipId) return;
			setClipRegions((prev) =>
				prev.map((clip) =>
					clip.id === selectedClipId ? { ...clip, showSourceAudio } : clip,
				),
			);
		},
		[selectedClipId],
	);

	const handleClipDelete = useCallback(
		(id: string) => {
			const deletedClip = clipRegions.find((clip) => clip.id === id);
			setClipRegions((prev) => prev.filter((clip) => clip.id !== id));
			if (deletedClip) {
				const { startMs, endMs } = deletedClip;
				setZoomRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
				setAnnotationRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
				setSpeedRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
				setAudioRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
			}
			if (selectedClipId === id) {
				setSelectedClipId(null);
			}
		},
		[clipRegions, selectedClipId],
	);

	const handleClipDuplicate = useCallback(
		(id: string, span?: Span) => {
			const target = clipRegions.find((c) => c.id === id);
			if (!target) return;
			const durationMs = target.endMs - target.startMs;
			const newStartMs = span ? Math.round(span.start) : target.endMs + 50;
			const maxMs = Math.round(duration * 1000);
			const newEndMs = span ? Math.round(span.end) : Math.min(newStartMs + durationMs, maxMs);
			const newId = `clip-${nextClipIdRef.current++}`;
			const duplicated: ClipRegion = {
				...target,
				id: newId,
				startMs: newStartMs,
				endMs: newEndMs,
			};
			setClipRegions((prev) => [...prev, duplicated]);
			setSelectedClipId(newId);
		},
		[clipRegions, duration],
	);

	const handleSelectAudio = useCallback((id: string | null) => {
		setSelectedAudioId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedAnnotationId(null);
			setActiveEffectSection("audio");
		}
	}, []);

	const handleAudioAdded = useCallback((span: Span, audioPath: string, trackIndex?: number) => {
		const id = `audio-${nextAudioIdRef.current++}`;
		const newRegion: AudioRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			audioPath,
			volume: 1,
			normalize: false,
			trackIndex,
		};
		setAudioRegions((prev) => [...prev, newRegion]);
		setSelectedAudioId(id);
		setSelectedZoomId(null);
		setSelectedAnnotationId(null);
		setActiveEffectSection("audio");
	}, []);
	handleAudioAddedRef.current = handleAudioAdded;

	const handleAudioSpanChange = useCallback((id: string, span: Span, trackIndex?: number) => {
		const normalizedTrackIndex =
			typeof trackIndex === "number" && Number.isFinite(trackIndex)
				? Math.max(0, Math.floor(trackIndex))
				: undefined;

		setAudioRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
							...(normalizedTrackIndex === undefined
								? {}
								: { trackIndex: normalizedTrackIndex }),
						}
					: region,
			),
		);
	}, []);

	const handleAudioVolumeChange = useCallback(
		(volume: number) => {
			if (!selectedAudioId) {
				return;
			}

			if (!Number.isFinite(volume)) {
				return;
			}

			const nextVolume = Math.max(0, Math.min(1, volume));
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === selectedAudioId ? { ...region, volume: nextVolume } : region,
				),
			);
		},
		[selectedAudioId],
	);

	const handleAudioDelete = useCallback(
		(id: string) => {
			setAudioRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedAudioId === id) {
				setSelectedAudioId(null);
			}
		},
		[selectedAudioId],
	);

	const handleAudioDuplicate = useCallback(
		(id: string, span?: Span, trackIndex?: number) => {
			const target = audioRegions.find((r) => r.id === id);
			if (!target) return;
			const durationMs = target.endMs - target.startMs;
			const newStartMs = span ? Math.round(span.start) : target.endMs + 50;
			const maxMs = Math.round(duration * 1000);
			const newEndMs = span ? Math.round(span.end) : Math.min(newStartMs + durationMs, maxMs);
			const resolvedTrack =
				typeof trackIndex === "number" && Number.isFinite(trackIndex)
					? Math.max(0, Math.floor(trackIndex))
					: (target.trackIndex ?? 0);
			const newId = `audio-${nextAudioIdRef.current++}`;
			const duplicated: AudioRegion = {
				...target,
				id: newId,
				startMs: newStartMs,
				endMs: newEndMs,
				trackIndex: resolvedTrack,
				isDuplicate: true,
			};
			setAudioRegions((prev) => [...prev, duplicated]);
			setSelectedAudioId(newId);
			setSelectedZoomId(null);
			setSelectedAnnotationId(null);
		},
		[audioRegions, duration],
	);

	const handleAudioNormalizeChange = useCallback(
		(normalize: boolean) => {
			if (!selectedAudioId) {
				return;
			}
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === selectedAudioId ? { ...region, normalize } : region,
				),
			);
		},
		[selectedAudioId],
	);

	const handleAudioFadeInChange = useCallback(
		(fadeInMs: number) => {
			if (!selectedAudioId) return;
			const safeMs = Math.max(0, Math.round(fadeInMs));
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === selectedAudioId ? { ...region, fadeInMs: safeMs } : region,
				),
			);
		},
		[selectedAudioId],
	);

	const handleAudioFadeOutChange = useCallback(
		(fadeOutMs: number) => {
			if (!selectedAudioId) return;
			const safeMs = Math.max(0, Math.round(fadeOutMs));
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === selectedAudioId ? { ...region, fadeOutMs: safeMs } : region,
				),
			);
		},
		[selectedAudioId],
	);

	const handleSplitAudio = useCallback(
		(audioId?: string | null, explicitSplitAtMs?: number) => {
			const targetId = audioId ?? selectedAudioId;
			if (!targetId) return;

			const targetRegion = audioRegions.find((r) => r.id === targetId);
			if (!targetRegion) return;

			const splitTimeMs =
				typeof explicitSplitAtMs === "number"
					? Math.round(explicitSplitAtMs)
					: Math.round(timelinePlayheadTime * 1000);

			if (
				splitTimeMs <= targetRegion.startMs + 100 ||
				splitTimeMs >= targetRegion.endMs - 100
			) {
				toast.info(
					t(
						"settings.audio.cannotSplitHere",
						"Di chuyển con trỏ phát vào bên trong đoạn nhạc để cắt",
					),
				);
				return;
			}

			const originalOffset = targetRegion.sourceOffsetMs ?? 0;
			const splitOffsetDelta = splitTimeMs - targetRegion.startMs;
			const newId = `audio-${nextAudioIdRef.current++}`;

			const firstRegion: AudioRegion = {
				...targetRegion,
				endMs: splitTimeMs,
				fadeOutMs: Math.min(
					targetRegion.fadeOutMs ?? 0,
					splitTimeMs - targetRegion.startMs,
				),
			};

			const secondRegion: AudioRegion = {
				...targetRegion,
				id: newId,
				startMs: splitTimeMs,
				sourceOffsetMs: originalOffset + splitOffsetDelta,
				fadeInMs: 0,
				fadeOutMs: targetRegion.fadeOutMs ?? 0,
			};

			setAudioRegions((prev) =>
				prev.map((r) => (r.id === targetId ? firstRegion : r)).concat(secondRegion),
			);
			setSelectedAudioId(newId);
			toast.success(t("settings.audio.splitSuccess", "Đã cắt nhạc thành công"));
		},
		[audioRegions, selectedAudioId, timelinePlayheadTime, t],
	);

	const handleAddAudioFromSettings = useCallback(() => {
		timelineRef.current?.addAudio();
	}, []);

	useEffect(() => {
		if (activeEffectSection === "audio" && !selectedAudioId && audioRegions.length > 0) {
			setSelectedAudioId(audioRegions[0].id);
		}
	}, [activeEffectSection, selectedAudioId, audioRegions]);

	const handleAddAnnotationFromSettings = useCallback(() => {
		const nextTrackIndex =
			annotationRegions.length > 0
				? Math.max(...annotationRegions.map((r) => r.trackIndex ?? 0)) + 1
				: 0;
		timelineRef.current?.addAnnotation(nextTrackIndex);
	}, [annotationRegions]);

	useEffect(() => {
		if (
			activeEffectSection === "annotation" &&
			!selectedAnnotationId &&
			annotationRegions.length > 0
		) {
			setSelectedAnnotationId(annotationRegions[0].id);
		}
	}, [activeEffectSection, selectedAnnotationId, annotationRegions]);

	const handleAnnotationAdded = useCallback((span: Span, trackIndex = 0) => {
		const id = `annotation-${nextAnnotationIdRef.current++}`;
		const zIndex = nextAnnotationZIndexRef.current++; // Assign z-index based on creation order
		const newRegion: AnnotationRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			type: "text",
			content: "Enter text...",
			position: { ...DEFAULT_ANNOTATION_POSITION },
			size: { ...DEFAULT_ANNOTATION_SIZE },
			style: { ...DEFAULT_ANNOTATION_STYLE },
			zIndex,
			trackIndex,
		};
		setAnnotationRegions((prev) => [...prev, newRegion]);
		setSelectedAnnotationId(id);
		setSelectedZoomId(null);
		setSelectedPanId(null);
		setSelectedAudioId(null);
		setActiveEffectSection("annotation");
	}, []);

	const handleAnnotationSpanChange = useCallback(
		(id: string, span: Span, trackIndex?: number) => {
			const normalizedTrackIndex =
				typeof trackIndex === "number" && Number.isFinite(trackIndex)
					? Math.max(0, Math.floor(trackIndex))
					: undefined;

			setAnnotationRegions((prev) =>
				prev.map((region) =>
					region.id === id
						? {
								...region,
								startMs: Math.round(span.start),
								endMs: Math.round(span.end),
								...(normalizedTrackIndex === undefined
									? {}
									: { trackIndex: normalizedTrackIndex }),
							}
						: region,
				),
			);
		},
		[],
	);

	const handleAnnotationDelete = useCallback(
		(id: string) => {
			setAnnotationRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedAnnotationId === id) {
				setSelectedAnnotationId(null);
			}
		},
		[selectedAnnotationId],
	);

	const handleAnnotationDuplicate = useCallback(
		(id: string, span?: Span, trackIndex?: number) => {
			const target = annotationRegions.find((r) => r.id === id);
			if (!target) return;
			const durationMs = target.endMs - target.startMs;
			const newStartMs = span ? Math.round(span.start) : target.endMs + 50;
			const maxMs = Math.round(duration * 1000);
			const newEndMs = span ? Math.round(span.end) : Math.min(newStartMs + durationMs, maxMs);
			const resolvedTrack =
				typeof trackIndex === "number" && Number.isFinite(trackIndex)
					? Math.max(0, Math.floor(trackIndex))
					: (target.trackIndex ?? 0);
			const newId = `annotation-${nextAnnotationIdRef.current++}`;
			const zIndex = nextAnnotationZIndexRef.current++;
			const duplicated: AnnotationRegion = {
				...target,
				id: newId,
				startMs: newStartMs,
				endMs: newEndMs,
				zIndex,
				trackIndex: resolvedTrack,
			};
			setAnnotationRegions((prev) => [...prev, duplicated]);
			setSelectedAnnotationId(newId);
			setSelectedZoomId(null);
			setSelectedPanId(null);
			setSelectedAudioId(null);
			setActiveEffectSection("annotation");
		},
		[annotationRegions, duration],
	);

	const handleAnnotationContentChange = useCallback((id: string, content: string) => {
		setAnnotationRegions((prev) => {
			const updated = prev.map((region) => {
				if (region.id !== id) return region;

				// Store content in type-specific fields
				if (region.type === "text") {
					return { ...region, content, textContent: content };
				} else if (region.type === "image") {
					return { ...region, content, imageContent: content };
				} else {
					return { ...region, content };
				}
			});
			return updated;
		});
	}, []);

	const handleAnnotationTypeChange = useCallback((id: string, type: AnnotationRegion["type"]) => {
		setAnnotationRegions((prev) => {
			const updated = prev.map((region) => {
				if (region.id !== id) return region;

				const updatedRegion = { ...region, type };

				// Restore content from type-specific storage
				if (type === "text") {
					updatedRegion.content = region.textContent || "Enter text...";
				} else if (type === "image") {
					updatedRegion.content = region.imageContent || "";
				} else if (type === "figure") {
					updatedRegion.content = "";
					if (!region.figureData) {
						updatedRegion.figureData = { ...DEFAULT_FIGURE_DATA };
					}
				} else if (type === "blur") {
					updatedRegion.content = "";
					if (region.blurIntensity === undefined) {
						updatedRegion.blurIntensity = 20;
					}
				}

				return updatedRegion;
			});
			return updated;
		});
	}, []);

	const handleAnnotationStyleChange = useCallback(
		(id: string, style: Partial<AnnotationRegion["style"]>) => {
			setAnnotationRegions((prev) =>
				prev.map((region) =>
					region.id === id ? { ...region, style: { ...region.style, ...style } } : region,
				),
			);
		},
		[],
	);

	const handleAnnotationFigureDataChange = useCallback((id: string, figureData: FigureData) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, figureData } : region)),
		);
	}, []);

	const handleAnnotationBlurIntensityChange = useCallback((id: string, blurIntensity: number) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, blurIntensity } : region)),
		);
	}, []);

	const handleAnnotationBlurColorChange = useCallback((id: string, blurColor: string) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, blurColor } : region)),
		);
	}, []);

	const handleAnnotationPositionChange = useCallback(
		(id: string, position: { x: number; y: number }) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, position } : region)),
			);
		},
		[],
	);

	const handleAnnotationSizeChange = useCallback(
		(id: string, size: { width: number; height: number }) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, size } : region)),
			);
		},
		[],
	);

	// Global Tab prevention
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const isEditableTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;

			const usesPrimaryModifier = isMac ? e.metaKey : e.ctrlKey;
			const key = e.key.toLowerCase();

			if (usesPrimaryModifier && !e.altKey && key === "z") {
				if (!isEditableTarget) {
					e.preventDefault();
					if (e.shiftKey) {
						handleRedo();
					} else {
						handleUndo();
					}
				}
				return;
			}

			if (!isMac && e.ctrlKey && !e.metaKey && !e.altKey && key === "y") {
				if (!isEditableTarget) {
					e.preventDefault();
					handleRedo();
				}
				return;
			}

			if (e.key === "Tab") {
				// Allow tab only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();
			}

			if (matchesShortcut(e, shortcuts.playPause, isMac)) {
				// Allow space only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();

				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					if (playback.video.paused) {
						playback.play().catch(console.error);
					} else {
						playback.pause();
					}
				}
			}

			if (
				(e.ctrlKey || e.metaKey) &&
				(e.key === "n" || e.key === "N" || (e.shiftKey && (e.key === "r" || e.key === "R")))
			) {
				if (!isEditableTarget) {
					e.preventDefault();
					void handleStartNewRecording();
					return;
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [shortcuts, isMac, handleUndo, handleRedo, handleStartNewRecording]);

	useEffect(() => {
		if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
			setSelectedZoomId(null);
		}
	}, [selectedZoomId, zoomRegions]);

	useEffect(() => {
		if (
			selectedAnnotationId &&
			!annotationRegions.some((region) => region.id === selectedAnnotationId)
		) {
			setSelectedAnnotationId(null);
		}
	}, [selectedAnnotationId, annotationRegions]);

	useEffect(() => {
		if (selectedAudioId && !audioRegions.some((region) => region.id === selectedAudioId)) {
			setSelectedAudioId(null);
		}
	}, [selectedAudioId, audioRegions]);

	const showExportSuccessToast = useCallback((filePath: string) => {
		toast.success(`Exported successfully to ${filePath}`, {
			action: {
				label: "Show in Folder",
				onClick: async () => {
					try {
						const result = await window.electronAPI.revealInFolder(filePath);
						if (!result.success) {
							const errorMessage =
								result.error ||
								result.message ||
								"Failed to reveal item in folder.";
							toast.error(errorMessage);
						}
					} catch (err) {
						toast.error(`Error revealing in folder: ${String(err)}`);
					}
				},
			},
		});
	}, []);

	const handleExport = useCallback(
		async (settings: ExportSettings) => {
			if (!videoPath) {
				toast.error("Chưa tải video nào");
				return;
			}

			const video = videoPlaybackRef.current?.video;
			if (!video) {
				toast.error("Video chưa sẵn sàng");
				return;
			}

			// Kiểm tra bản quyền & chặn Full HD (1080p) / 4K sau khi hết 5 lượt free
			let requireWatermark = false;
			const targetQuality = smokeExportConfig.enabled
				? (smokeExportConfig.quality ?? settings.quality ?? exportQuality)
				: (settings.quality ?? exportQuality);
			const targetFps = smokeExportConfig.enabled
				? (smokeExportConfig.fps ?? settings.mp4FrameRate ?? mp4FrameRate)
				: (settings.mp4FrameRate ?? mp4FrameRate);

			let estimatedExportWidth = 1920;
			let estimatedExportHeight = 1080;

			if (settings.format === "gif" && settings.gifConfig) {
				estimatedExportWidth = settings.gifConfig.width;
				estimatedExportHeight = settings.gifConfig.height;
			} else {
				try {
					const supportedDims = await ensureSupportedMp4SourceDimensions(targetFps);
					const dims = calculateMp4ExportDimensions(
						supportedDims.width,
						supportedDims.height,
						targetQuality,
					);
					estimatedExportWidth = dims.width;
					estimatedExportHeight = dims.height;
				} catch (_) {}
			}

			try {
				if (window.electronAPI?.checkCanRecord) {
					const check = await window.electronAPI.checkCanRecord({
						quality: targetQuality,
						width: estimatedExportWidth,
						height: estimatedExportHeight,
						format: settings.format,
					});
					if (!check.allowed) {
						toast.error(
							check.message ||
								"Độ phân giải Full HD (1080p) và 4K yêu cầu bản quyền PRO! Bạn có thể chuyển sang độ phân giải 720p (Medium) hoặc nâng cấp bản quyền PRO.",
							{ duration: 8000 },
						);
						setLicenseModalOpen(true);
						return;
					}
					if (check.requireWatermark) {
						requireWatermark = true;
						toast.info("Đang xuất video độ phân giải 720p (kèm logo bản quyền Record-AutoZoom).", {
							duration: 6000,
						});
					}
				}
			} catch (err) {
				console.warn("Could not check export limit:", err);
			}

			// Tạo danh sách annotations đã bao gồm Logo bản quyền (Watermark) nếu hết 5 lượt free
			const effectiveAnnotationRegions = [...annotationRegions];
			if (requireWatermark) {
				effectiveAnnotationRegions.push({
					id: "record-autozoom-watermark",
					startMs: 0,
					endMs: 999999999,
					type: "text",
					content: "RECORD-AUTOZOOM",
					textContent: "RECORD-AUTOZOOM",
					position: { x: 74, y: 92 },
					size: { width: 24, height: 5.5 },
					style: {
						color: "rgba(255, 255, 255, 0.95)",
						backgroundColor: "rgba(12, 6, 22, 0.78)",
						fontSize: 22,
						fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif',
						fontWeight: "bold",
						fontStyle: "normal",
						textDecoration: "none",
						textAlign: "center",
						borderRadius: 8,
					},
					zIndex: 999999,
				});
			}

			setIsExporting(true);
			setExportProgress(null);
			setExportError(null);
			clearPendingExportSave();
			extensionHost.emitEvent({ type: "export:start" });
			const smokeExportStartedAt = smokeExportConfig.enabled ? performance.now() : null;

			let keepExportDialogOpen = false;

			try {
				const wasPlaying = isPlaying;
				const restoreTime = video.currentTime;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}

				// Get preview CONTAINER dimensions for scaling
				const playbackRef = videoPlaybackRef.current;
				const containerElement = playbackRef?.containerRef?.current;
				const previewWidth = containerElement?.clientWidth || 1920;
				const previewHeight = containerElement?.clientHeight || 1080;
				const effectiveShadowIntensity =
					smokeExportConfig.enabled && smokeExportConfig.shadowIntensity !== undefined
						? smokeExportConfig.shadowIntensity
						: shadowIntensity;
				const smokeProgressSamples: Array<Record<string, unknown>> = [];
				let lastSmokeProgressSampleAt = 0;
				let lastSmokeProgressPhase: ExportProgress["phase"] | undefined;
				const recordSmokeProgress = (progress: ExportProgress) => {
					if (!smokeExportConfig.enabled || smokeExportStartedAt === null) {
						return;
					}

					const now = performance.now();
					const phase = progress.phase ?? "extracting";
					const shouldSample =
						smokeProgressSamples.length === 0 ||
						phase !== lastSmokeProgressPhase ||
						now - lastSmokeProgressSampleAt >= 1000 ||
						progress.currentFrame >= progress.totalFrames;

					if (!shouldSample) {
						return;
					}

					smokeProgressSamples.push({
						elapsedMs: Math.round(now - smokeExportStartedAt),
						phase,
						currentFrame: progress.currentFrame,
						totalFrames: progress.totalFrames,
						percentage: progress.percentage,
						estimatedTimeRemaining: progress.estimatedTimeRemaining,
						renderFps: progress.renderFps,
						renderBackend: progress.renderBackend,
						encodeBackend: progress.encodeBackend,
						encoderName: progress.encoderName,
					});
					lastSmokeProgressSampleAt = now;
					lastSmokeProgressPhase = phase;
				};

				if (settings.format === "gif" && settings.gifConfig) {
					// GIF Export
					const gifExporter = new GifExporter({
						videoUrl: videoPath,
						width: settings.gifConfig.width,
						height: settings.gifConfig.height,
						frameRate: settings.gifConfig.frameRate,
						loop: settings.gifConfig.loop,
						sizePreset: settings.gifConfig.sizePreset,
						wallpaper,
						trimRegions,
						speedRegions: effectiveSpeedRegions,
						showShadow: effectiveShadowIntensity > 0,
						shadowIntensity: effectiveShadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						zoomMotionBlurTuning,
						zoomTemporalMotionBlur,
						zoomMotionBlurSampleCount,
						zoomMotionBlurShutterFraction,
						connectZooms,
						zoomInDurationMs,
						zoomInOverlapMs,
						zoomOutDurationMs,
						connectedZoomGapMs,
						connectedZoomDurationMs,
						zoomInEasing,
						zoomOutEasing,
						connectedZoomEasing,
						borderRadius,
						padding,
						videoPadding: padding,
						cropRegion,
						webcam,
						webcamUrl:
							resolvedWebcamVideoUrl ??
							(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
						annotationRegions: effectiveAnnotationRegions,
						zoomRegions: effectiveZoomRegions,
						panRegions: effectivePanRegionsInSourceTime,
						cursorTelemetry: effectiveCursorTelemetry,
						showCursor: effectiveShowCursor,
						cursorStyle,
						cursorSize,
						cursorSmoothing,
						cursorSpringStiffnessMultiplier,
						cursorSpringDampingMultiplier,
						cursorSpringMassMultiplier,
						cameraSpringStiffnessMultiplier,
						cameraSpringDampingMultiplier,
						cameraSpringMassMultiplier,
						zoomSmoothness,
						zoomSpeed,
						zoomClassicMode,
						cursorMotionBlur,
						cursorClickBounce,
						cursorClickBounceDuration,
						cursorSway,
						frame,
						previewWidth,
						previewHeight,
						maxDecodeQueue: smokeExportConfig.maxDecodeQueue,
						maxPendingFrames: smokeExportConfig.maxPendingFrames,
						onProgress: (progress: ExportProgress) => {
							recordSmokeProgress(progress);
							setExportProgress(progress);
						},
					});

					exporterRef.current = gifExporter as unknown as VideoExporter;
					const result = await gifExporter.export();

					if (result.success && result.blob) {
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.gif`;
						markExportAsSaving();

						const { saveResult, pendingSave } = await saveBlobExport(
							result.blob,
							fileName,
							smokeExportConfig.enabled ? smokeExportConfig.outputPath : null,
						);

						if (saveResult.canceled) {
							pendingExportSaveRef.current = pendingSave;
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Đã hủy. Bạn có thể lưu lại mà không cần xuất lại.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							if (smokeExportStartedAt !== null) {
								console.log(
									`[smoke-export] Completed in ${Math.round(performance.now() - smokeExportStartedAt)}ms (${saveResult.path})`,
								);
							}
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);

							// Tiêu thụ 1 lượt xuất video miễn phí nếu chưa có PRO
							try {
								if (window.electronAPI?.consumeRecording) {
									const usageRes = await window.electronAPI.consumeRecording();
									if (usageRes.message) {
										toast.info(usageRes.message, { duration: 6000 });
									}
								}
							} catch (e) {
								console.warn("Failed to consume export usage:", e);
							}

							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						} else {
							setExportError(saveResult.message || "Luu GIF th?t b?i");
							toast.error(saveResult.message || "Luu GIF th?t b?i");
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						}
					} else {
						setExportError(result.error || "GIF export failed");
						toast.error(result.error || "GIF export failed");
						if (smokeExportConfig.enabled) {
							window.close();
							return;
						}
					}
				} else {
					// MP4 Export
					const quality = smokeExportConfig.enabled
						? (smokeExportConfig.quality ?? settings.quality ?? exportQuality)
						: (settings.quality ?? exportQuality);
					const encodingMode = smokeExportConfig.enabled
						? (smokeExportConfig.encodingMode ??
							settings.encodingMode ??
							exportEncodingMode)
						: (settings.encodingMode ?? exportEncodingMode);
					const selectedMp4FrameRate = smokeExportConfig.enabled
						? (smokeExportConfig.fps ?? settings.mp4FrameRate ?? mp4FrameRate)
						: (settings.mp4FrameRate ?? mp4FrameRate);
					const pipelineModel = smokeExportConfig.enabled
						? (smokeExportConfig.pipelineModel ?? "modern")
						: (settings.pipelineModel ?? exportPipelineModel);
					const useExperimentalNativeExport =
						pipelineModel === "modern" &&
						(smokeExportConfig.enabled ? smokeExportConfig.useNativeExport : true);
					const backendPreference =
						pipelineModel === "legacy"
							? "webcodecs"
							: smokeExportConfig.enabled
								? (smokeExportConfig.backendPreference ??
									(smokeExportConfig.useNativeExport ? "breeze" : "webcodecs"))
								: useExperimentalNativeExport
									? "auto"
									: (settings.backendPreference ?? exportBackendPreference);
					const supportedSourceDimensions =
						await ensureSupportedMp4SourceDimensions(selectedMp4FrameRate);
					const { width: exportWidth, height: exportHeight } =
						calculateMp4ExportDimensions(
							supportedSourceDimensions.width,
							supportedSourceDimensions.height,
							quality,
						);
					const bitrate = getMp4ExportBitrate({
						width: exportWidth,
						height: exportHeight,
						frameRate: selectedMp4FrameRate,
						quality,
						encodingMode,
						useModernNativeStaticLayout: useExperimentalNativeExport,
					});
					const sourceAudioTrackSettingsForExport =
						selectedClipId !== null
							? audio.selectedClipSourceAudioTrackSettings
							: audio.activeSourceAudioTrackSettings;

					const exporterConfig = {
						videoUrl: videoPath,
						width: exportWidth,
						height: exportHeight,
						frameRate: selectedMp4FrameRate,
						bitrate,
						codec: DEFAULT_MP4_CODEC,
						encodingMode,
						preferredEncoderPath: supportedSourceDimensions.encoderPath,
						preferredRenderBackend: smokeExportConfig.renderBackend,
						experimentalNativeExport: useExperimentalNativeExport,
						maxEncodeQueue: smokeExportConfig.maxEncodeQueue,
						maxDecodeQueue: smokeExportConfig.maxDecodeQueue,
						maxPendingFrames: smokeExportConfig.maxPendingFrames,
						wallpaper,
						trimRegions,
						speedRegions: effectiveSpeedRegions,
						showShadow: effectiveShadowIntensity > 0,
						shadowIntensity: effectiveShadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						zoomMotionBlurTuning,
						zoomTemporalMotionBlur,
						zoomMotionBlurSampleCount,
						zoomMotionBlurShutterFraction,
						connectZooms,
						zoomInDurationMs,
						zoomInOverlapMs,
						zoomOutDurationMs,
						connectedZoomGapMs,
						connectedZoomDurationMs,
						zoomInEasing,
						zoomOutEasing,
						connectedZoomEasing,
						borderRadius,
						padding,
						cropRegion,
						webcam,
						webcamUrl:
							resolvedWebcamVideoUrl ??
							(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
						annotationRegions: effectiveAnnotationRegions,
						zoomRegions: effectiveZoomRegions,
						panRegions: effectivePanRegionsInSourceTime,
						cursorTelemetry: effectiveCursorTelemetry,
						showCursor: effectiveShowCursor,
						cursorStyle,
						cursorSize,
						cursorSmoothing,
						cursorSpringStiffnessMultiplier,
						cursorSpringDampingMultiplier,
						cursorSpringMassMultiplier,
						cameraSpringStiffnessMultiplier,
						cameraSpringDampingMultiplier,
						cameraSpringMassMultiplier,
						zoomSmoothness,
						zoomSpeed,
						zoomClassicMode,
						cursorMotionBlur,
						cursorClickBounce,
						cursorClickBounceDuration,
						cursorSway,
						clickSound,
						clickSoundStyle,
						clickSoundVolume,
						frame,
						audioRegions,
						clipRegions,
						sourceAudioFallbackPaths: audio.sourceAudioFallbackPaths,
						sourceAudioFallbackStartDelayMsByPath:
							audio.sourceAudioFallbackStartDelayMsByPath,
						sourceAudioTrackSettings: sourceAudioTrackSettingsForExport,
						previewWidth,
						previewHeight,
						onProgress: (progress: ExportProgress) => {
							recordSmokeProgress(progress);
							setExportProgress(progress);
						},
					};

					const exporter =
						pipelineModel === "modern"
							? new ModernVideoExporter({
									...exporterConfig,
									backendPreference,
								})
							: new VideoExporter(exporterConfig);

					exporterRef.current = exporter;
					const result = await exporter.export();
					const smokeExportElapsedMs =
						smokeExportStartedAt !== null
							? Math.round(performance.now() - smokeExportStartedAt)
							: undefined;

					if (result.success && (result.blob || result.tempFilePath)) {
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.mp4`;
						markExportAsSaving();

						let saveResult: {
							success: boolean;
							path?: string;
							message?: string;
							canceled?: boolean;
						};
						let pendingOnCancel: PendingExportSave;

						if (result.tempFilePath) {
							// Preferred path: main process already holds the finished MP4 on
							// disk, so we just ask it to move the temp file into place. This
							// avoids ever allocating a multi-GiB ArrayBuffer in the renderer.
							saveResult = await window.electronAPI.finalizeExportedVideo({
								tempPath: result.tempFilePath,
								fileName,
								outputPath:
									smokeExportConfig.enabled && smokeExportConfig.outputPath
										? smokeExportConfig.outputPath
										: null,
							});
							pendingOnCancel = { fileName, tempFilePath: result.tempFilePath };
						} else if (result.blob) {
							// Legacy fallback: some export paths still surface a Blob, but in
							// Electron we stream it into a temp file first so save/finalize
							// never requires a giant renderer ArrayBuffer.
							const blobSave = await saveBlobExport(
								result.blob,
								fileName,
								smokeExportConfig.enabled ? smokeExportConfig.outputPath : null,
							);
							saveResult = blobSave.saveResult;
							pendingOnCancel = blobSave.pendingSave;
						} else {
							saveResult = { success: false, message: "Export produced no output" };
							pendingOnCancel = { fileName };
						}

						if (saveResult.canceled) {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: false,
									phase: "save",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									error: "Đã hủy lưu",
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							pendingExportSaveRef.current = pendingOnCancel;
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Đã hủy. Bạn có thể lưu lại mà không cần xuất lại.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: true,
									phase: "saved",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									outputPath: saveResult.path,
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							if (smokeExportStartedAt !== null) {
								console.log(
									`[smoke-export] Completed in ${Math.round(performance.now() - smokeExportStartedAt)}ms (${saveResult.path})`,
								);
							}
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);

							// Tiêu thụ 1 lượt xuất video miễn phí nếu chưa có PRO
							try {
								if (window.electronAPI?.consumeRecording) {
									const usageRes = await window.electronAPI.consumeRecording();
									if (usageRes.message) {
										toast.info(usageRes.message, { duration: 6000 });
									}
								}
							} catch (e) {
								console.warn("Failed to consume export usage:", e);
							}
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						} else {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: false,
									phase: "save",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									error: saveResult.message || "Luu video th?t b?i",
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							setExportError(saveResult.message || "Luu video th?t b?i");
							showExportErrorToast(saveResult.message || "Luu video th?t b?i");
							// Keep the pending-save entry so the user can retry without
							// re-rendering. The temp file is still on disk (the main
							// process only moves/deletes it on success) and the
							// ArrayBuffer fallback still references its in-memory blob.
							if (pendingOnCancel.tempFilePath || pendingOnCancel.arrayBuffer) {
								pendingExportSaveRef.current = pendingOnCancel;
								setHasPendingExportSave(true);
								keepExportDialogOpen = true;
							}
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						}
					} else {
						if (smokeExportConfig.enabled) {
							await writeSmokeExportReport(smokeExportConfig.outputPath, {
								success: false,
								phase: "export",
								format: "mp4",
								pipelineModel,
								backendPreference,
								encodingMode,
								shadowIntensity: effectiveShadowIntensity,
								elapsedMs: smokeExportElapsedMs,
								error: result.error || "Export failed",
								progressSamples: smokeProgressSamples,
								metrics: result.metrics,
							});
						}
						setExportError(result.error || "Export failed");
						showExportErrorToast(result.error || "Export failed");
						keepExportDialogOpen = true;
						if (smokeExportConfig.enabled) {
							window.close();
							return;
						}
					}
				}

				if (wasPlaying) {
					videoPlaybackRef.current?.play();
				} else {
					video.currentTime = restoreTime;
				}
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				if (smokeExportConfig.enabled) {
					await writeSmokeExportReport(smokeExportConfig.outputPath, {
						success: false,
						phase: "exception",
						format: settings.format,
						elapsedMs:
							smokeExportStartedAt !== null
								? Math.round(performance.now() - smokeExportStartedAt)
								: undefined,
						error: errorMessage,
					});
				}
				setExportError(errorMessage);
				showExportErrorToast(`Export failed: ${errorMessage}`);
				keepExportDialogOpen = true;
				if (smokeExportConfig.enabled) {
					window.close();
				}
			} finally {
				extensionHost.emitEvent({ type: "export:complete" });
				setIsExporting(false);
				exporterRef.current = null;
				setShowExportDropdown(keepExportDialogOpen);
				remountPreview();
			}
		},
		[
			clearPendingExportSave,
			videoPath,
			wallpaper,
			trimRegions,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			effectiveShowCursor,
			cursorStyle,
			effectiveCursorTelemetry,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			zoomSmoothness,
			zoomSpeed,
			zoomClassicMode,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			audioRegions,
			clipRegions,
			audio.sourceAudioFallbackPaths,
			audio.sourceAudioFallbackStartDelayMsByPath,
			audio.activeSourceAudioTrackSettings,
			audio.selectedClipSourceAudioTrackSettings,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			borderRadius,
			padding,
			cropRegion,
			webcam,
			resolvedWebcamVideoUrl,
			annotationRegions,
			isPlaying,
			exportQuality,
			effectiveZoomRegions,
			ensureSupportedMp4SourceDimensions,
			markExportAsSaving,
			mp4FrameRate,
			remountPreview,
			showExportSuccessToast,
			smokeExportConfig.backendPreference,
			smokeExportConfig.renderBackend,
			smokeExportConfig.enabled,
			smokeExportConfig.useNativeExport,
			smokeExportConfig.maxDecodeQueue,
			smokeExportConfig.maxEncodeQueue,
			smokeExportConfig.maxPendingFrames,
			smokeExportConfig.outputPath,
			smokeExportConfig.pipelineModel,
			smokeExportConfig.shadowIntensity,
			effectiveSpeedRegions,
			frame,
			selectedClipId,
			smokeExportConfig.encodingMode,
			smokeExportConfig.fps,
			smokeExportConfig.quality,
			saveBlobExport,
		],
	);

	useEffect(() => {
		smokeExportReadyStateRef.current = {
			cursorTelemetrySourcePath,
			duration,
			hasVideoPath: Boolean(videoPath),
			isPreviewReady,
			loading,
			projectPath: smokeExportConfig.projectPath ?? null,
			videoSourcePath,
		};
	}, [
		cursorTelemetrySourcePath,
		duration,
		isPreviewReady,
		loading,
		smokeExportConfig.projectPath,
		videoPath,
		videoSourcePath,
	]);

	useEffect(() => {
		if (!smokeExportConfig.enabled) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			if (smokeExportStartedRef.current) {
				return;
			}

			smokeExportStartedRef.current = true;
			void writeSmokeExportReport(smokeExportConfig.outputPath, {
				success: false,
				phase: "ready",
				error: `Smoke export did not become ready within ${SMOKE_EXPORT_READY_TIMEOUT_MS}ms.`,
				readyState: smokeExportReadyStateRef.current,
			}).finally(() => window.close());
		}, SMOKE_EXPORT_READY_TIMEOUT_MS);

		return () => window.clearTimeout(timeoutId);
	}, [smokeExportConfig.enabled, smokeExportConfig.outputPath]);

	useEffect(() => {
		if (!smokeExportConfig.enabled || smokeExportStartedRef.current) {
			return;
		}

		if (error) {
			smokeExportStartedRef.current = true;
			console.error(`[smoke-export] ${error}`);
			void writeSmokeExportReport(smokeExportConfig.outputPath, {
				success: false,
				phase: "load",
				error,
				readyState: smokeExportReadyStateRef.current,
			}).finally(() => window.close());
			return;
		}

		if (!videoPath || loading || !isPreviewReady || duration <= 0) {
			return;
		}

		// When smoke-export opens a .recordly project, the cursor telemetry
		// sidecar is loaded asynchronously after the editor state applies.
		// Without this gate the auto-export fires before telemetry arrives and
		// produces a video with no cursor/zoom animations.
		if (
			smokeExportConfig.projectPath &&
			videoSourcePath &&
			cursorTelemetrySourcePath !== videoSourcePath
		) {
			return;
		}

		smokeExportStartedRef.current = true;
		void handleExport({
			format: "mp4",
			quality: "good",
			encodingMode: smokeExportConfig.encodingMode ?? "balanced",
		});
	}, [
		cursorTelemetrySourcePath,
		error,
		handleExport,
		isPreviewReady,
		loading,
		duration,
		smokeExportConfig.enabled,
		smokeExportConfig.encodingMode,
		smokeExportConfig.outputPath,
		smokeExportConfig.projectPath,
		videoPath,
		videoSourcePath,
	]);

	const handleOpenExportDropdown = useCallback(() => {
		if (!videoPath) {
			toast.error("Chưa tải video nào");
			return;
		}

		if (hasPendingExportSave) {
			setShowExportDropdown(true);
			setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			return;
		}
		setShowExportDropdown(true);
		setExportProgress(null);
		setExportError(null);
	}, [videoPath, hasPendingExportSave]);

	const handleStartExportFromDropdown = useCallback(() => {
		const video = videoPlaybackRef.current?.video;
		if (!videoPath) {
			toast.error("Chưa tải video nào");
			return;
		}
		if (!video) {
			toast.error("Video chưa sẵn sàng");
			return;
		}

		if (!isProUser) {
			const targetUrl = "https://record-autozoom.pages.dev/checkout";
			if (window.electronAPI?.openExternalUrl) {
				window.electronAPI.openExternalUrl(targetUrl);
			} else {
				window.open(targetUrl, "_blank");
			}
			setLicenseModalOpen(true);
			toast.info("Vui lòng kích hoạt bản quyền PRO để xuất video!");
			return;
		}

		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const gifDimensions = calculateOutputDimensions(
			sourceWidth,
			sourceHeight,
			gifSizePreset,
			GIF_SIZE_PRESETS,
		);

		const settings: ExportSettings = {
			format: exportFormat,
			encodingMode: exportFormat === "mp4" ? exportEncodingMode : undefined,
			mp4FrameRate: exportFormat === "mp4" ? mp4FrameRate : undefined,
			backendPreference: exportFormat === "mp4" ? exportBackendPreference : undefined,
			pipelineModel: exportFormat === "mp4" ? exportPipelineModel : undefined,
			quality: exportFormat === "mp4" ? exportQuality : undefined,
			gifConfig:
				exportFormat === "gif"
					? {
							frameRate: gifFrameRate,
							loop: gifLoop,
							sizePreset: gifSizePreset,
							width: gifDimensions.width,
							height: gifDimensions.height,
						}
					: undefined,
		};

		setExportError(null);
		setExportedFilePath(undefined);
		setShowExportDropdown(true);
		handleExport(settings);
	}, [
		videoPath,
		exportFormat,
		exportEncodingMode,
		exportQuality,
		mp4FrameRate,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		exportBackendPreference,
		exportPipelineModel,
		handleExport,
		isProUser,
	]);

	const handleCancelExport = useCallback(() => {
		if (exporterRef.current) {
			exporterRef.current.cancel();
			toast.info("Export canceled");
			clearPendingExportSave();
			setShowExportDropdown(false);
			setIsExporting(false);
			setExportProgress(null);
			setExportError(null);
			setExportedFilePath(undefined);
		}
	}, [clearPendingExportSave]);

	const handleExportDropdownClose = useCallback(() => {
		clearPendingExportSave();
		setShowExportDropdown(false);
		setExportProgress(null);
		setExportError(null);
		setExportedFilePath(undefined);
	}, [clearPendingExportSave]);

	const handleRetrySaveExport = useCallback(async () => {
		const pendingSave = pendingExportSaveRef.current;
		if (!pendingSave) {
			return;
		}

		let saveResult: {
			success: boolean;
			path?: string;
			message?: string;
			canceled?: boolean;
		};

		if (pendingSave.tempFilePath) {
			saveResult = await window.electronAPI.finalizeExportedVideo({
				tempPath: pendingSave.tempFilePath,
				fileName: pendingSave.fileName,
				outputPath: null,
			});
		} else if (pendingSave.arrayBuffer) {
			saveResult = await window.electronAPI.saveExportedVideo(
				pendingSave.arrayBuffer,
				pendingSave.fileName,
			);
		} else {
			saveResult = { success: false, message: "No pending export to save" };
		}

		if (saveResult.canceled) {
			setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			toast.info("Đã hủy. Bạn có thể thử lưu lại.");
			return;
		}

		if (saveResult.success && saveResult.path) {
			// finalizeExportedVideo already moved the temp file into place, so the
			// pending-save entry no longer refers to a file on disk. Flip the flag
			// directly to avoid clearPendingExportSave issuing a spurious discard.
			pendingExportSaveRef.current = null;
			setHasPendingExportSave(false);
			setExportError(null);
			setExportedFilePath(saveResult.path);
			showExportSuccessToast(saveResult.path);
			setShowExportDropdown(true);
			return;
		}

		const errorMessage = saveResult.message || "Luu video th?t b?i";
		setExportError(errorMessage);
		toast.error(errorMessage);
	}, [showExportSuccessToast]);

	const handleOpenCropEditor = useCallback(() => {
		cropSnapshotRef.current = { ...cropRegion };
		setShowCropModal(true);
	}, [cropRegion]);

	const handleCloseCropEditor = useCallback(() => {
		setShowCropModal(false);
	}, []);

	const handleCancelCropEditor = useCallback(() => {
		if (cropSnapshotRef.current) {
			setCropRegion(cropSnapshotRef.current);
		}
		setShowCropModal(false);
	}, []);

	const isCropped = useMemo(() => {
		const top = Math.round(cropRegion.y * 100);
		const left = Math.round(cropRegion.x * 100);
		const bottom = Math.round((1 - cropRegion.y - cropRegion.height) * 100);
		const right = Math.round((1 - cropRegion.x - cropRegion.width) * 100);
		return top > 0 || left > 0 || bottom > 0 || right > 0;
	}, [cropRegion]);

	const revealExportedFile = useCallback(async () => {
		if (!exportedFilePath) return;

		try {
			const result = await window.electronAPI.revealInFolder(exportedFilePath);
			if (!result.success) {
				toast.error(result.error || result.message || "Failed to reveal item in folder.");
			}
		} catch (error) {
			toast.error(`Failed to reveal item in folder: ${String(error)}`);
		}
	}, [exportedFilePath]);

	const openLightningIssues = useCallback(async () => {
		await openExternalLink(
			RECORDLY_ISSUES_URL,
			t("editor.feedback.openFailed", "Failed to open link."),
		);
	}, [t]);

	const isExportSaving = exportProgress?.phase === "saving";
	const isExportPreparing =
		isExporting && (!exportProgress || exportProgress.phase === "preparing");
	const isExportFinalizing = exportProgress?.phase === "finalizing";
	const isRenderingAudio =
		isExportFinalizing && typeof exportProgress?.audioProgress === "number";
	const exportFinalizingProgress = isExportFinalizing
		? Math.min(
				typeof exportProgress?.renderProgress === "number"
					? exportProgress.renderProgress
					: (exportProgress?.percentage ?? 100),
				100,
			)
		: null;
	const exportFinalizingPercent = isExportFinalizing
		? Math.round(exportFinalizingProgress ?? 100)
		: null;
	const isExportMuxingAndSaving =
		isExportFinalizing &&
		exportFormat === "mp4" &&
		exportPipelineModel === "modern" &&
		!isRenderingAudio;
	const isExportFinalSaveIndeterminate =
		isExportMuxingAndSaving && (exportFinalizingPercent ?? 0) >= 98;
	const isLightningExportInProgress =
		exportFormat === "mp4" &&
		exportPipelineModel === "modern" &&
		(isExporting || exportProgress !== null);
	const shouldSuspendPreviewRendering =
		isExporting && exportFormat === "mp4" && exportPipelineModel === "modern";
	const isLegacyExportInProgress =
		exportFormat === "mp4" &&
		exportPipelineModel === "legacy" &&
		(isExporting || exportProgress !== null);
	const exportRenderSpeedLabel =
		!isExportPreparing &&
		!isExportFinalizing &&
		!isExportSaving &&
		typeof exportProgress?.renderFps === "number" &&
		Number.isFinite(exportProgress.renderFps) &&
		exportProgress.renderFps > 0
			? t("editor.exportStatus.renderSpeed", "Render speed {{fps}} FPS", {
					fps: exportProgress.renderFps.toFixed(1),
				})
			: null;
	const exportRuntimeLabel = useMemo(() => {
		const renderBackend = exportProgress?.renderBackend;
		const encodeBackend = exportProgress?.encodeBackend;
		const encoderName = exportProgress?.encoderName;

		if (!renderBackend && !encodeBackend && !encoderName) {
			return null;
		}

		const rendererLabel =
			renderBackend === "webgpu" ? "WebGPU" : renderBackend === "webgl" ? "WebGL" : null;
		const encoderLabel =
			encodeBackend === "ffmpeg"
				? "Breeze"
				: encodeBackend === "webcodecs"
					? "WebCodecs"
					: null;
		const pathLabel =
			rendererLabel && encoderLabel
				? `${rendererLabel} + ${encoderLabel}`
				: (rendererLabel ?? encoderLabel);

		if (!pathLabel) {
			return encoderName ?? null;
		}

		return encoderName ? `${pathLabel} (${encoderName})` : pathLabel;
	}, [exportProgress]);
	const exportNativeSkipReasons =
		exportProgress?.nativeStaticLayoutSkipReasons &&
		exportProgress.nativeStaticLayoutSkipReasons.length > 0
			? exportProgress.nativeStaticLayoutSkipReasons
			: exportProgress?.nativeStaticLayoutSkipReason
				? [exportProgress.nativeStaticLayoutSkipReason]
				: [];
	const exportNativeSkipLabel =
		exportNativeSkipReasons.length > 0
			? `Native skipped: ${exportNativeSkipReasons[0]}${
					exportNativeSkipReasons.length > 1
						? ` (+${exportNativeSkipReasons.length - 1} more)`
						: ""
				}`
			: null;
	const exportPercentLabel = exportProgress
		? isExportPreparing
			? t("editor.exportStatus.preparing", "Preparing export...")
			: isExportSaving
				? t("editor.exportStatus.saving", "Opening save dialog...")
				: isRenderingAudio
					? t("editor.exportStatus.renderingAudio", "Rendering audio {{percent}}%", {
							percent: Math.round((exportProgress.audioProgress ?? 0) * 100),
						})
					: isExportFinalizing
						? exportFormat === "mp4" && exportPipelineModel === "modern"
							? isExportFinalSaveIndeterminate
								? t(
										"editor.exportStatus.muxingAndSaving",
										"Muxing audio and saving file...",
									)
								: t(
										"editor.exportStatus.muxingAndSavingPercent",
										"Muxing and saving {{percent}}%",
										{
											percent: exportFinalizingPercent ?? 100,
										},
									)
							: t(
									"editor.exportStatus.finalizingPercent",
									"Finalizing {{percent}}%",
									{
										percent: exportFinalizingPercent ?? 100,
									},
								)
						: t("editor.exportStatus.completePercent", "{{percent}}% complete", {
								percent: Math.round(exportProgress.percentage),
							})
		: t("editor.exportStatus.preparing", "Preparing export...");

	const projectBrowser = (
		<ProjectBrowserDialog
			open={projectBrowserOpen}
			onOpenChange={setProjectBrowserOpen}
			entries={projectLibraryEntries}
			currentThumbnailUrl={currentThumbnailUrl}
			anchorRef={error ? projectBrowserFallbackTriggerRef : projectBrowserTriggerRef}
			onOpenProject={(projectPath) => {
				void handleOpenProjectFromLibrary(projectPath);
			}}
		/>
	);
	const nativeCaptureUnavailableDialog = (
		<Dialog
			open={nativeCaptureUnavailableModalOpen}
			onOpenChange={setNativeCaptureUnavailableModalOpen}
		>
			<DialogContent className="max-w-md bg-editor-dialog border-foreground/10 text-foreground">
				<DialogHeader>
					<DialogTitle>
						{t(
							"editor.nativeCaptureUnavailable.title",
							"Nothing’s broken, but we won’t be able to render an animated cursor overlay.",
						)}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{t(
							"editor.nativeCaptureUnavailable.description",
							"Your device does not support native capture. This could be for a variety of reasons we haven’t figured out yet. This doesn’t break Record Auto-Zoom, but it does make cursor smoothing impossible.",
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button onClick={() => setNativeCaptureUnavailableModalOpen(false)}>
						{t("editor.nativeCaptureUnavailable.confirm", "Okay")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="text-foreground">Loading video...</div>
				{projectBrowser}
				{nativeCaptureUnavailableDialog}
				<Toaster className="pointer-events-auto" />
			</div>
		);
	}
	if (error) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4 max-w-md text-center p-6 bg-neutral-900/60 rounded-xl border border-neutral-800 backdrop-blur-sm">
					<div className="text-sm text-neutral-300 font-medium">{error}</div>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<button
							type="button"
							onClick={async () => {
								setError(null);
								const res = await window.electronAPI.openRecorder();
								if (!res?.success) {
									setError((res as any)?.error || "No video to load. Please record or select a video.");
								}
							}}
							className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-500 hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
						>
							<span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
							Record Screen
						</button>
						<button
							type="button"
							onClick={async () => {
								const res = await window.electronAPI.openVideoFilePicker();
								if (res?.success && (res.path || (res as any).filePath)) {
									setError(null);
								}
							}}
							className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:scale-105 active:scale-95 cursor-pointer"
						>
							Select Video File
						</button>
						<button
							ref={projectBrowserFallbackTriggerRef}
							type="button"
							onClick={handleOpenProjectBrowser}
							className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-neutral-700 active:scale-95 cursor-pointer"
						>
							Open Projects
						</button>
					</div>
				</div>
				{projectBrowser}
				{nativeCaptureUnavailableDialog}
				<Toaster className="pointer-events-auto" />
			</div>
		);
	}

	return (
		<div
			className="flex flex-col h-screen bg-slate-100 text-slate-800 dark:bg-[#090615] dark:text-white overflow-hidden selection:bg-purple-500/30 relative transition-colors duration-300"
			onDragOver={handleDragOver}
			onDrop={(e) => void handleDrop(e)}
		>
			{/* Apple Liquid Glass Ambient Glows */}
			<div aria-hidden="true" className="fixed -top-40 -left-40 w-[550px] h-[550px] bg-purple-600/10 dark:bg-purple-600/12 rounded-full blur-[150px] pointer-events-none z-0" />
			<div aria-hidden="true" className="fixed top-1/4 -right-40 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
			<div aria-hidden="true" className="fixed -bottom-40 left-1/3 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

			<div
				className="relative flex h-11 flex-shrink-0 items-center justify-between bg-white/75 dark:bg-[#110c24]/80 px-5 backdrop-blur-3xl border-b border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_15px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-50 transition-colors duration-300"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div
					className={`flex items-center gap-1.5 justify-self-start ${headerLeftControlsPaddingClass}`}
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<Button
						ref={projectBrowserTriggerRef}
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleOpenProjectBrowser}
						className={APP_HEADER_ICON_BUTTON_CLASS}
						title={t("editor.project.projects", "Open projects")}
						aria-label={t("editor.project.projects", "Open projects")}
					>
						<FolderOpen className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleOpenVideoFile}
						className={APP_HEADER_ICON_BUTTON_CLASS}
						title={t("launch.openVideoFile", "Open video file")}
						aria-label={t("launch.openVideoFile", "Open video file")}
					>
						<Upload className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleStartNewRecording}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] border border-red-500/25 bg-red-500/10 p-0 text-red-500 transition-colors hover:bg-red-500/20 hover:text-red-600 active:scale-95 cursor-pointer shadow-sm"
						title={t("launch.recording.recordNewTooltip", "Quay video mới (Ctrl+N)")}
						aria-label={t("launch.recording.recordNew", "Quay video mới")}
					>
						<VideoCamera className="h-4 w-4 text-red-500" weight="fill" />
					</Button>
					<div className="ml-1 h-5 w-px bg-foreground/10" />
					<Button
						type="button"
						variant="ghost"
						onClick={handleUndo}
						disabled={!canUndo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] border border-foreground/10 bg-foreground/5 p-0 text-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title={t("common.actions.undo", "Undo")}
						aria-label={t("common.actions.undo", "Undo")}
					>
						<Undo2 className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						onClick={handleRedo}
						disabled={!canRedo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] border border-foreground/10 bg-foreground/5 p-0 text-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title={t("common.actions.redo", "Redo")}
						aria-label={t("common.actions.redo", "Redo")}
					>
						<Redo2 className="h-4 w-4" />
					</Button>
				</div>
				<div
					className="absolute left-1/2 flex min-w-0 -translate-x-1/2 items-center justify-center"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{isEditingProjectName ? (
						<form
							onSubmit={(event) => void handleProjectNameSubmit(event)}
							className="flex max-w-[min(52vw,460px)] items-baseline gap-1 rounded-[7px] border border-foreground/10 bg-editor-panel/[0.88] px-2.5 py-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
						>
							{hasUnsavedChanges ? (
								<span className="mt-[1px] size-2 shrink-0 rounded-full bg-[#2563EB]" />
							) : null}
							<input
								ref={projectNameInputRef}
								type="text"
								value={projectNameDraft}
								onChange={(event) => setProjectNameDraft(event.target.value)}
								onBlur={() => {
									if (!isSavingProjectName) {
										closeProjectNameEditor();
									}
								}}
								onKeyDown={(event) => {
									if (event.key === "Escape") {
										event.preventDefault();
										closeProjectNameEditor();
									}
								}}
								disabled={isSavingProjectName}
								className="min-w-[10ch] max-w-[min(40vw,360px)] bg-transparent text-sm font-semibold tracking-tight text-foreground/95 outline-none placeholder:text-muted-foreground/60 disabled:cursor-wait"
								style={{ width: `${Math.max(projectNameDraft.length, 10)}ch` }}
								aria-label={t("editor.project.renameInput", "Project name")}
							/>
							{!isAutoRecordingName ? (
								<span className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground/70">
									.recordly
								</span>
							) : null}
						</form>
					) : (
						<button
							type="button"
							onClick={() => setIsEditingProjectName(true)}
							className="inline-flex max-w-[min(52vw,460px)] items-baseline gap-1 rounded-[7px] px-2.5 py-1 transition-colors hover:bg-foreground/5"
							title={t("editor.project.renameTitle", "Rename project")}
							aria-label={t("editor.project.renameTitle", "Rename project")}
						>
							{hasUnsavedChanges ? (
								<span className="mt-[1px] size-2 shrink-0 rounded-full bg-[#2563EB]" />
							) : null}
							<span className="truncate text-sm font-semibold tracking-tight text-foreground/90">
								{effectiveProjectDisplayName}
							</span>
							{!isAutoRecordingName ? (
								<span className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground/70">
									.recordly
								</span>
							) : null}
						</button>
					)}
				</div>
				<div
					className="flex items-center justify-self-end pr-3"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<Button
						type="button"
						size="sm"
						onClick={() => {
							setLicenseModalOpen(true);
						}}
						className={cn(
							"inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-xs font-semibold tracking-tight transition-all duration-150 cursor-pointer mr-2",
							isProUser
								? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/15"
								: "bg-foreground/[0.07] hover:bg-foreground/[0.12] text-foreground border border-foreground/12 hover:border-foreground/25 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-[0.98]"
						)}
						title={isProUser ? "PRO License Active" : "Upgrade"}
					>
						{isProUser ? (
							<>
								<Crown weight="fill" className="h-3.5 w-3.5 text-emerald-500" />
								<span className="font-semibold text-xs tracking-tight">PRO Active</span>
							</>
						) : (
							<>
								<Crown weight="fill" className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
								<span className="font-semibold text-xs tracking-tight">Upgrade</span>
							</>
						)}
					</Button>


					<DropdownMenu
						open={showExportDropdown}
						onOpenChange={setShowExportDropdown}
						modal={false}
					>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								onClick={handleOpenExportDropdown}
								className="inline-flex h-8 min-w-[88px] items-center justify-center gap-1.5 rounded-[7px] bg-[#007AFF] hover:bg-[#0071E3] px-3.5 text-white text-xs font-semibold tracking-tight shadow-[0_1px_3px_rgba(0,122,255,0.35)] transition-all active:scale-[0.98]"
							>
								<Download className="h-3.5 w-3.5" />
								<span>Export</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							sideOffset={10}
							className="w-[380px] border-none bg-transparent p-0 shadow-none"
						>
							{isExporting ? (
								<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
									<div className="mb-3 flex items-center justify-between gap-3">
										<div>
											<p className="text-sm font-semibold text-foreground">
												{t("editor.exportStatus.exporting", "Exporting")}
											</p>
											<p className="text-xs text-muted-foreground">
												{t(
													"editor.exportStatus.renderingFile",
													"Rendering your file.",
												)}
											</p>
											{isLightningExportInProgress ? (
												<p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
													Vui lòng
													<button
														type="button"
														onClick={() => void openLightningIssues()}
														className="underline decoration-slate-500/70 underline-offset-2 transition-colors hover:text-foreground"
													>
														báo lỗi
													</button>
													với tính năng xuất Lightning
													<span aria-hidden="true">{"\u{1F64F}"}</span>
												</p>
											) : null}
											{isLegacyExportInProgress ? (
												<p className="mt-1 text-[11px] text-muted-foreground/70">
													Xuất chậm? Hủy và thử xuất Lightning!
												</p>
											) : null}
										</div>
										<Button
											type="button"
											variant="outline"
											onClick={handleCancelExport}
											className="h-8 border-red-500/20 bg-red-500/10 px-3 text-xs text-red-400 hover:bg-red-500/20"
										>
											{t("common.actions.cancel")}
										</Button>
									</div>
									<div className="h-2 overflow-hidden rounded-full border border-foreground/5 bg-foreground/5">
										{isExportPreparing ||
										isExportSaving ||
										isExportFinalSaveIndeterminate ? (
											<div className="indeterminate-progress h-full rounded-full bg-transparent" />
										) : (
											<div
												className="h-full bg-[#2563EB] transition-all duration-300 ease-out"
												style={{
													width: `${Math.min(isRenderingAudio ? (exportProgress.audioProgress ?? 0) * 100 : (exportFinalizingProgress ?? exportProgress?.percentage ?? 8), 100)}%`,
												}}
											/>
										)}
									</div>
									<p className="mt-2 text-xs text-muted-foreground">
										{exportPercentLabel}
									</p>
									{isRenderingAudio ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											{t(
												"editor.export.processingAudioEdits",
												"Processing audio with speed/overlay edits",
											)}
										</p>
									) : exportRenderSpeedLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											{exportRenderSpeedLabel}
										</p>
									) : null}
									{exportRuntimeLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											Đường dẫn: {exportRuntimeLabel}
										</p>
									) : null}
									{exportNativeSkipLabel ? (
										<p className="mt-1 text-[11px] text-amber-500/80">
											{exportNativeSkipLabel}
										</p>
									) : null}
								</div>
							) : exportError ? (
								<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
									<p className="text-sm font-semibold text-foreground">
										{t("editor.exportStatus.issue", "Export issue")}
									</p>
									{exportRuntimeLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											Đường dẫn: {exportRuntimeLabel}
										</p>
									) : null}
									<p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
										{exportError}
									</p>
									<div className="mt-4 flex gap-2">
										{hasPendingExportSave ? (
											<Button
												type="button"
												onClick={handleRetrySaveExport}
												className="h-8 flex-1 rounded-[5px] bg-[#2563EB] text-xs font-semibold text-white hover:bg-[#2563EB]/92"
											>
												{t("editor.actions.saveAgain", "Save Again")}
											</Button>
										) : null}
										<Button
											type="button"
											variant="outline"
											onClick={handleExportDropdownClose}
											className="h-8 flex-1 border-foreground/10 bg-foreground/5 text-xs text-muted-foreground hover:bg-foreground/10"
										>
											{t("common.actions.close", "Close")}
										</Button>
									</div>
								</div>
							) : exportedFilePath ? (
								<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
									<p className="text-sm font-semibold text-foreground">
										{t("editor.exportStatus.complete", "Export complete")}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{t(
											"editor.exportStatus.savedSuccessfully",
											"Your file was saved successfully.",
										)}
									</p>
									{exportRuntimeLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											Đường dẫn: {exportRuntimeLabel}
										</p>
									) : null}
									<p className="mt-3 truncate text-xs text-muted-foreground/70">
										{exportedFilePath.split("/").pop()}
									</p>
									<div className="mt-4 flex gap-2">
										<Button
											type="button"
											onClick={revealExportedFile}
											className="h-8 flex-1 rounded-[5px] bg-[#2563EB] text-xs font-semibold text-white hover:bg-[#2563EB]/92"
										>
											{t("editor.actions.showInFolder", "Show In Folder")}
										</Button>
										<Button
											type="button"
											variant="outline"
											onClick={handleExportDropdownClose}
											className="h-8 flex-1 border-foreground/10 bg-foreground/5 text-xs text-muted-foreground hover:bg-foreground/10"
										>
											{t("common.actions.done", "Xong")}
										</Button>
									</div>
								</div>
							) : (
								<ExportSettingsMenu
									exportFormat={exportFormat}
									onExportFormatChange={setExportFormat}
									exportEncodingMode={exportEncodingMode}
									onExportEncodingModeChange={setExportEncodingMode}
									mp4FrameRate={mp4FrameRate}
									onMp4FrameRateChange={setMp4FrameRate}
									exportPipelineModel={exportPipelineModel}
									onExportPipelineModelChange={setExportPipelineModel}
									exportQuality={exportQuality}
									onExportQualityChange={setExportQuality}
									gifFrameRate={gifFrameRate}
									onGifFrameRateChange={setGifFrameRate}
									gifLoop={gifLoop}
									onGifLoopChange={setGifLoop}
									gifSizePreset={gifSizePreset}
									onGifSizePresetChange={setGifSizePreset}
									mp4OutputDimensions={mp4OutputDimensions}
									gifOutputDimensions={gifOutputDimensions}
									isProUser={isProUser}
									trialExhausted={!isProUser && freeTrialRemaining <= 0}
									onExport={handleStartExportFromDropdown}
									className="shadow-2xl"
								/>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div className="relative flex min-h-0 flex-1 flex-col gap-3 p-4">
				<div className="flex min-h-0 flex-1 gap-3 relative z-10">
					{/* Settings sidebar */}
					<div className="flex flex-shrink-0 gap-1.5">
						{/* Icon rail */}
						<div className="flex flex-shrink-0 flex-col items-center justify-between py-1 px-0.5 h-full min-h-0">
							{/* Nhóm các công cụ chỉnh sửa phía trên */}
							<div className="flex flex-col items-center gap-2">
								{editorSectionButtons
									.filter((section) => section.id !== "settings")
									.map((section) => {
										const isActive = activeEffectSection === section.id;
										const theme = SECTION_THEMES[section.id] ?? UNIFIED_RAIL_THEME;

										return (
											<div
												key={section.id}
												className="relative flex items-center"
											>
												<motion.button
													type="button"
													onClick={() => setActiveEffectSection(section.id)}
													title={section.label}
													whileHover={{ scale: 1.05 }}
													whileTap={{ scale: 0.95 }}
													className={cn(
														"group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 outline-none focus:outline-none backdrop-blur-sm",
														isActive
															? theme.activeClass
															: theme.inactiveClass,
													)}
												>
													<span className="relative z-10 flex items-center justify-center">
														{typeof section.icon === "string" ? (
															<ExtensionIcon
																icon={section.icon}
																extensionPath={section.extensionPath}
																className="h-[21px] w-[21px]"
															/>
														) : (
															<section.icon
																className="h-[21px] w-[21px]"
																weight={isActive ? "fill" : "duotone"}
															/>
														)}
													</span>
												</motion.button>
												<div className="ml-1 w-1 h-5 flex-shrink-0 flex items-center justify-center">
													{isActive && (
														<motion.span
															layoutId="rail-active-pill"
															className={cn(
																"w-1 h-5 rounded-full",
																theme.dotClass,
															)}
															initial={{ opacity: 0, scaleY: 0.4 }}
															animate={{ opacity: 1, scaleY: 1 }}
															exit={{ opacity: 0, scaleY: 0.4 }}
															transition={{
																type: "spring",
																stiffness: 450,
																damping: 30,
															}}
														/>
													)}
												</div>
											</div>
										);
									})}
							</div>

							{/* Icon Cài đặt (Settings) đặt ở DƯỚI CÙNG theo chuẩn Apple */}
							<div className="mt-auto flex flex-col items-center gap-2 pt-3">
								{(() => {
									const settingsSection = editorSectionButtons.find((s) => s.id === "settings");
									if (!settingsSection) return null;
									const isActive = activeEffectSection === "settings";
									const theme = SECTION_THEMES.settings ?? UNIFIED_RAIL_THEME;

									return (
										<div
											key="settings"
											className="relative flex items-center"
										>
											<motion.button
												type="button"
												onClick={() => setActiveEffectSection("settings")}
												title={settingsSection.label}
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												className={cn(
													"group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 outline-none focus:outline-none backdrop-blur-sm",
													isActive
														? theme.activeClass
														: theme.inactiveClass,
												)}
											>
												<span className="relative z-10 flex items-center justify-center">
													<PhSettings
														className="h-[21px] w-[21px]"
														weight={isActive ? "fill" : "duotone"}
													/>
												</span>
											</motion.button>
											<div className="ml-1 w-1 h-5 flex-shrink-0 flex items-center justify-center">
												{isActive && (
													<motion.span
														layoutId="rail-active-pill"
														className={cn(
															"w-1 h-5 rounded-full",
															theme.dotClass,
														)}
														initial={{ opacity: 0, scaleY: 0.4 }}
														animate={{ opacity: 1, scaleY: 1 }}
														exit={{ opacity: 0, scaleY: 0.4 }}
														transition={{
															type: "spring",
															stiffness: 450,
															damping: 30,
														}}
													/>
												)}
											</div>
										</div>
									);
								})()}
							</div>
						</div>
						{/* Panel */}
						{
							<SettingsPanel
								panelMode="editor"
								activeEffectSection={activeEffectSection}
								selected={wallpaper}
								onWallpaperChange={setWallpaper}
								selectedZoomDepth={
									selectedZoomId
										? zoomRegions.find((z) => z.id === selectedZoomId)?.depth
										: null
								}
								onZoomDepthChange={(depth) =>
									selectedZoomId && handleZoomDepthChange(depth)
								}
								selectedZoomId={selectedZoomId}
								selectedZoomMode={
									selectedZoomId
										? (zoomRegions.find((z) => z.id === selectedZoomId)?.mode ??
											"auto")
										: null
								}
								onZoomModeChange={(mode) =>
									selectedZoomId && handleZoomModeChange(mode)
								}
								onZoomDelete={handleZoomDelete}
								selectedClipId={selectedClipId}
								selectedClipSpeed={
									selectedClipId
										? (clipRegions.find((c) => c.id === selectedClipId)
												?.speed ?? 1)
										: null
								}
								selectedClipMuted={
									selectedClipId
										? (clipRegions.find((c) => c.id === selectedClipId)
												?.muted ?? false)
										: null
								}
								selectedClipShowSourceAudio={
									selectedClipId
										? (clipRegions.find((c) => c.id === selectedClipId)
												?.showSourceAudio ?? false)
										: null
								}
								onClipSpeedChange={handleClipSpeedChange}
								onClipMutedChange={handleClipMutedChange}
								onClipShowSourceAudioChange={handleClipShowSourceAudioChange}
								onClipDelete={handleClipDelete}
								hasClipSourceAudio={hasClipSourceAudio}
								sourceAudioTrackMeta={audio.sourceAudioTrackMeta}
								sourceAudioTrackSettings={
									audio.selectedClipSourceAudioTrackSettings
								}
								onSourceAudioTrackVolumeChange={
									audio.onSelectedClipSourceAudioTrackVolumeChange
								}
								onSourceAudioTrackNormalizeChange={
									audio.onSelectedClipSourceAudioTrackNormalizeChange
								}
								selectedAudioId={selectedAudioId}
								selectedAudioVolume={
									selectedAudioId
										? (audioRegions.find((r) => r.id === selectedAudioId)
												?.volume ?? null)
										: null
								}
								selectedAudioNormalize={
									selectedAudioId
										? (audioRegions.find((r) => r.id === selectedAudioId)
												?.normalize ?? false)
										: null
								}
								selectedAudioFadeInMs={
									selectedAudioId
										? (audioRegions.find((r) => r.id === selectedAudioId)
												?.fadeInMs ?? 0)
										: null
								}
								selectedAudioFadeOutMs={
									selectedAudioId
										? (audioRegions.find((r) => r.id === selectedAudioId)
												?.fadeOutMs ?? 0)
										: null
								}
								audioRegions={audioRegions}
								timelinePlayheadTimeMs={Math.round(timelinePlayheadTime * 1000)}
								onAudioVolumeChange={handleAudioVolumeChange}
								onAudioNormalizeChange={handleAudioNormalizeChange}
								onAudioFadeInChange={handleAudioFadeInChange}
								onAudioFadeOutChange={handleAudioFadeOutChange}
								onAudioSplit={handleSplitAudio}
								onAddAudio={handleAddAudioFromSettings}
								onSelectAudio={handleSelectAudio}
								onAudioDelete={handleAudioDelete}
								shadowIntensity={shadowIntensity}
								onShadowChange={setShadowIntensity}
								backgroundBlur={backgroundBlur}
								onBackgroundBlurChange={setBackgroundBlur}
								zoomMotionBlurTuning={zoomMotionBlurTuning}
								onZoomMotionBlurTuningChange={setZoomMotionBlurTuning}
								zoomTemporalMotionBlur={zoomTemporalMotionBlur}
								onZoomTemporalMotionBlurChange={setZoomTemporalMotionBlur}
								zoomMotionBlurSampleCount={zoomMotionBlurSampleCount}
								onZoomMotionBlurSampleCountChange={setZoomMotionBlurSampleCount}
								zoomMotionBlurShutterFraction={zoomMotionBlurShutterFraction}
								onZoomMotionBlurShutterFractionChange={
									setZoomMotionBlurShutterFraction
								}
								autoApplyFreshRecordingAutoZooms={autoApplyFreshRecordingAutoZooms}
								onAutoApplyFreshRecordingAutoZoomsChange={
									setAutoApplyFreshRecordingAutoZooms
								}
								connectZooms={connectZooms}
								onConnectZoomsChange={setConnectZooms}
								zoomSpeed={zoomSpeed}
								onZoomSpeedChange={setZoomSpeed}
								zoomInDurationMs={zoomInDurationMs}
								onZoomInDurationMsChange={setZoomInDurationMs}
								zoomInOverlapMs={zoomInOverlapMs}
								onZoomInOverlapMsChange={setZoomInOverlapMs}
								zoomOutDurationMs={zoomOutDurationMs}
								onZoomOutDurationMsChange={setZoomOutDurationMs}
								connectedZoomGapMs={connectedZoomGapMs}
								onConnectedZoomGapMsChange={setConnectedZoomGapMs}
								connectedZoomDurationMs={connectedZoomDurationMs}
								onConnectedZoomDurationMsChange={setConnectedZoomDurationMs}
								zoomInEasing={zoomInEasing}
								onZoomInEasingChange={setZoomInEasing}
								zoomOutEasing={zoomOutEasing}
								onZoomOutEasingChange={setZoomOutEasing}
								connectedZoomEasing={connectedZoomEasing}
								onConnectedZoomEasingChange={setConnectedZoomEasing}
								showCursor={effectiveShowCursor}
								onShowCursorChange={handleShowCursorChange}
								loopCursor={loopCursor}
								onLoopCursorChange={setLoopCursor}
								cursorStyle={cursorStyle}
								onCursorStyleChange={setCursorStyle}
								cursorSize={cursorSize}
								onCursorSizeChange={setCursorSize}
								cursorSmoothing={cursorSmoothing}
								onCursorSmoothingChange={setCursorSmoothing}
								cursorSpringStiffnessMultiplier={cursorSpringStiffnessMultiplier}
								onCursorSpringStiffnessMultiplierChange={
									setCursorSpringStiffnessMultiplier
								}
								cursorSpringDampingMultiplier={cursorSpringDampingMultiplier}
								onCursorSpringDampingMultiplierChange={
									setCursorSpringDampingMultiplier
								}
								cursorSpringMassMultiplier={cursorSpringMassMultiplier}
								onCursorSpringMassMultiplierChange={setCursorSpringMassMultiplier}
								cameraSpringStiffnessMultiplier={cameraSpringStiffnessMultiplier}
								onCameraSpringStiffnessMultiplierChange={
									setCameraSpringStiffnessMultiplier
								}
								cameraSpringDampingMultiplier={cameraSpringDampingMultiplier}
								onCameraSpringDampingMultiplierChange={
									setCameraSpringDampingMultiplier
								}
								cameraSpringMassMultiplier={cameraSpringMassMultiplier}
								onCameraSpringMassMultiplierChange={setCameraSpringMassMultiplier}
								zoomClassicMode={zoomClassicMode}
								onZoomClassicModeChange={setZoomClassicMode}
								cursorMotionBlur={cursorMotionBlur}
								onCursorMotionBlurChange={setCursorMotionBlur}
								cursorClickBounce={cursorClickBounce}
								onCursorClickBounceChange={setCursorClickBounce}
								cursorClickBounceDuration={cursorClickBounceDuration}
								onCursorClickBounceDurationChange={setCursorClickBounceDuration}
								showClickEffect={showClickEffect}
								smartCameraEnabled={smartCameraEnabled}
								onSmartCameraEnabledChange={handleSmartCameraEnabledChange}
								smartCameraScale={smartCameraScale}
								onSmartCameraScaleChange={setSmartCameraScale}
								onShowClickEffectChange={setShowClickEffect}
								clickEffectStyle={clickEffectStyle}
								onClickEffectStyleChange={setClickEffectStyle}
								clickEffectSize={clickEffectSize}
								onClickEffectSizeChange={setClickEffectSize}
								clickSound={clickSound}
								onClickSoundChange={setClickSound}
								clickSoundStyle={clickSoundStyle}
								onClickSoundStyleChange={setClickSoundStyle}
								clickSoundVolume={clickSoundVolume}
								onClickSoundVolumeChange={setClickSoundVolume}
								cursorSway={cursorSway}
								onCursorSwayChange={setCursorSway}
								borderRadius={borderRadius}
								onBorderRadiusChange={setBorderRadius}
								webcam={webcam}
								webcamPreviewSrc={
									webcam.sourcePath ? resolvedWebcamVideoUrl : videoPath || null
								}
								webcamPreviewCurrentTime={currentTime}
								webcamPreviewPlaying={isPlaying}
								onWebcamChange={setWebcam}
								onUploadWebcam={handleUploadWebcam}
								onRecordWebcam={() => setRecordWebcamDialogOpen(true)}
								onClearWebcam={handleClearWebcam}
								padding={padding}
								onPaddingChange={setPadding}
								frame={frame}
								onFrameChange={setFrame}
								cropRegion={cropRegion}
								onCropChange={setCropRegion}
								aspectRatio={aspectRatio}
								onAspectRatioChange={setAspectRatio}
								selectedAnnotationId={selectedAnnotationId}
								annotationRegions={annotationRegions}
								nativeCaptureUnavailableSession={sessionNativeCaptureUnavailable}
								onOpenNativeCaptureUnavailableModal={() =>
									setNativeCaptureUnavailableModalOpen(true)
								}
								onAnnotationContentChange={handleAnnotationContentChange}
								onAnnotationTypeChange={handleAnnotationTypeChange}
								onAnnotationStyleChange={handleAnnotationStyleChange}
								onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
								onAnnotationBlurIntensityChange={
									handleAnnotationBlurIntensityChange
								}
								onAnnotationBlurColorChange={handleAnnotationBlurColorChange}
								onAnnotationDelete={handleAnnotationDelete}
								onSelectAnnotation={handleSelectAnnotation}
								onAddAnnotation={handleAddAnnotationFromSettings}
								onAnnotationSizeChange={handleAnnotationSizeChange}
							/>
						}
					</div>
					{/* Right column: preview + timeline */}
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						{/* Preview */}
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
								{/* Aspect ratio + crop controls above preview */}
								<div className="flex items-center justify-center gap-2 py-1.5 flex-shrink-0">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1"
											>
												<span className="font-medium">
													{getAspectRatioLabel(aspectRatio)}
												</span>
												<ChevronDown className="w-3 h-3" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="center"
											className="bg-editor-surface-alt border-foreground/10"
										>
											{ASPECT_RATIOS.map((ratio) => (
												<DropdownMenuItem
													key={ratio}
													onClick={() => setAspectRatio(ratio)}
													className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer flex items-center justify-between gap-3"
												>
													<span>{getAspectRatioLabel(ratio)}</span>
													{aspectRatio === ratio && (
														<Check className="w-3 h-3 text-[#2563EB]" />
													)}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
									<div className="w-[1px] h-4 bg-foreground/20" />
									<Button
										variant="ghost"
										size="sm"
										onClick={handleOpenCropEditor}
										className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1.5"
									>
										<Crop className="w-3.5 h-3.5" />
										<span className="font-medium">
											{t("settings.crop.title")}
										</span>
										{isCropped ? (
											<span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
										) : null}
									</Button>
								</div>
								{/* Video preview */}
								<div
									className="flex w-full min-h-0 flex-1 items-stretch"
									style={{ flex: "1 1 auto", margin: "6px 0 0" }}
								>
									<div className="flex min-w-0 flex-1 items-center justify-center px-1">
										<div
											className="relative overflow-hidden"
											style={{
												width: "auto",
												height: "100%",
												aspectRatio: getAspectRatioValue(
													aspectRatio,
													(() => {
														const previewVideo =
															videoPlaybackRef.current?.video;
														if (
															previewVideo &&
															previewVideo.videoHeight > 0
														) {
															return (
																previewVideo.videoWidth /
																previewVideo.videoHeight
															);
														}
														return 16 / 9;
													})(),
												),
												maxWidth: "100%",
												margin: "0 auto",
												boxSizing: "border-box",
												transform: "translateZ(0)",
												isolation: "isolate",
												backfaceVisibility: "hidden",
											}}
										>
											<VideoPlayback
												key={`${videoPath || "no-video"}:${previewVersion}`}
												aspectRatio={aspectRatio}
												ref={videoPlaybackRef}
												videoPath={videoPath || ""}
												onDurationChange={setDuration}
												onPreviewReadyChange={setIsPreviewReady}
												onTimeUpdate={setCurrentTime}
												currentTime={currentTime}
												onPlayStateChange={setIsPlaying}
												onError={setError}
												wallpaper={wallpaper}
												zoomRegions={effectiveZoomRegions}
												panRegions={effectivePanRegionsInSourceTime}
												selectedZoomId={selectedZoomId}
												onSelectZoom={handleSelectZoom}
												onZoomFocusChange={handleZoomFocusChange}
												isPlaying={isPlaying}
												showShadow={shadowIntensity > 0}
												shadowIntensity={shadowIntensity}
												backgroundBlur={backgroundBlur}
												connectZooms={connectZooms}
												zoomInDurationMs={zoomInDurationMs}
												zoomInOverlapMs={zoomInOverlapMs}
												zoomOutDurationMs={zoomOutDurationMs}
												connectedZoomGapMs={connectedZoomGapMs}
												connectedZoomDurationMs={connectedZoomDurationMs}
												zoomInEasing={zoomInEasing}
												zoomOutEasing={zoomOutEasing}
												connectedZoomEasing={connectedZoomEasing}
												borderRadius={borderRadius}
												padding={padding}
												frame={frame}
												cropRegion={cropRegion}
												webcam={webcam}
												webcamVideoPath={
													webcam.sourcePath
														? resolvedWebcamVideoUrl
														: webcam.enabled
															? resolvedWebcamVideoUrl ||
																videoPath ||
																null
															: null
												}
												trimRegions={trimRegions}
												speedRegions={effectiveSpeedRegions}
												annotationRegions={annotationRegions}
												selectedAnnotationId={selectedAnnotationId}
												onSelectAnnotation={handleSelectAnnotation}
												onAnnotationPositionChange={
													handleAnnotationPositionChange
												}
												onAnnotationSizeChange={handleAnnotationSizeChange}
												cursorTelemetry={effectiveCursorTelemetry}
												showCursor={effectiveShowCursor}
												cursorStyle={cursorStyle}
												cursorSize={cursorSize}
												cursorSmoothing={cursorSmoothing}
												cursorSpringStiffnessMultiplier={
													cursorSpringStiffnessMultiplier
												}
												cursorSpringDampingMultiplier={
													cursorSpringDampingMultiplier
												}
												cursorSpringMassMultiplier={
													cursorSpringMassMultiplier
												}
												cameraSpringStiffnessMultiplier={
													cameraSpringStiffnessMultiplier
												}
												cameraSpringDampingMultiplier={
													cameraSpringDampingMultiplier
												}
												cameraSpringMassMultiplier={
													cameraSpringMassMultiplier
												}
												zoomSmoothness={zoomSmoothness}
												zoomSpeed={zoomSpeed}
												zoomClassicMode={zoomClassicMode}
												zoomMotionBlur={zoomMotionBlur}
												zoomMotionBlurTuning={zoomMotionBlurTuning}
												cursorMotionBlur={cursorMotionBlur}
												cursorClickBounce={cursorClickBounce}
												showClickEffect={showClickEffect}
												smartCameraEnabled={smartCameraEnabled}
												smartCameraScale={smartCameraScale}
												clickEffectStyle={clickEffectStyle}
												clickEffectSize={clickEffectSize}
												clickSound={clickSound}
												clickSoundStyle={clickSoundStyle}
												clickSoundVolume={clickSoundVolume}
												cursorClickBounceDuration={
													cursorClickBounceDuration
												}
												cursorSway={cursorSway}
												volume={
													audio.shouldMutePreviewVideo ||
													audio.isCurrentClipMuted
														? 0
														: Math.max(
																0,
																Math.min(
																	1,
																	previewVolume *
																		audio.embeddedSourcePreviewGain,
																),
															)
												}
												suspendRendering={shouldSuspendPreviewRendering}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
						{/* Toolbar - sits at bottom of right column, only spans preview width */}
						<div className="relative flex flex-shrink-0 items-center px-1 py-1">
							{/* Left tools */}
							<div className="z-10 flex min-w-0 flex-1 items-center gap-1.5">
								<Button
									onClick={() => timelineRef.current?.addZoom()}
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
									title={t("timeline.zoom.addZoom")}
									disabled={smartCameraEnabled}
								>
									<ZoomIn className="w-4 h-4" />
								</Button>
								<Button
									onClick={() => timelineRef.current?.suggestZooms()}
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
									title={t("timeline.zoom.suggestZooms")}
									disabled={smartCameraEnabled}
								>
									<WandSparkles className="w-4 h-4" />
								</Button>
							</div>
							{/* Playback controls - centered */}
							<div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
								<div className="flex items-center gap-1.5 pointer-events-auto">
									<span className="mr-1 text-[10px] font-medium tabular-nums text-muted-foreground">
										{formatTime(timelinePlayheadTime)}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
										title={t("editor.playback.skipBack")}
										onClick={() => {
											const currentMs = timelinePlayheadTime * 1000;
											const kfs = timelineRef.current?.keyframes ?? [];
											const prev = [...kfs]
												.reverse()
												.find((k) => k.time < currentMs - 50);
											handleSeek(
												prev
													? prev.time / 1000
													: Math.max(0, timelinePlayheadTime - 5),
											);
										}}
									>
										<SkipBack className="w-3.5 h-3.5" weight="fill" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className={`h-7 w-7 rounded-full border border-foreground/10 transition-all shadow-[0_8px_18px_rgba(0,0,0,0.18)] ${isPlaying ? "bg-foreground/10 text-foreground hover:bg-foreground/20" : "bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-white/90"}`}
										onClick={togglePlayPause}
										title={isPlaying ? "Pause" : "Play"}
									>
										{isPlaying ? (
											<Pause className="w-3.5 h-3.5" weight="fill" />
										) : (
											<Play className="w-3.5 h-3.5" weight="fill" />
										)}
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
										title={t("editor.playback.skipForward")}
										onClick={() => {
											const currentMs = timelinePlayheadTime * 1000;
											const kfs = timelineRef.current?.keyframes ?? [];
											const next = kfs.find((k) => k.time > currentMs + 50);
											handleSeek(
												next
													? next.time / 1000
													: Math.min(
															timelineDuration,
															timelinePlayheadTime + 5,
														),
											);
										}}
									>
										<SkipForward className="w-3.5 h-3.5" weight="fill" />
									</Button>
									<span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums ml-1">
										{formatTime(timelineDuration)}
									</span>
								</div>
							</div>
							{/* Right: collapse + volume */}
							<div className="z-10 ml-auto flex items-center gap-2">
								<Button
									variant="ghost"
									size="icon"
									title={
										timelineCollapsed
											? t("editor.timeline.expand")
											: t("editor.timeline.collapse")
									}
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
									onClick={() => {
										setTimelineCollapsed((p) => !p);
									}}
								>
									{timelineCollapsed ? (
										<ChevronUp className="w-3.5 h-3.5" />
									) : (
										<ChevronDown className="w-3.5 h-3.5" />
									)}
								</Button>
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										className="text-muted-foreground hover:text-foreground transition-colors"
										title={t("editor.playback.muteUnmute")}
										onClick={() =>
											setPreviewVolume(previewVolume <= 0.001 ? 1 : 0)
										}
									>
										{previewVolume <= 0.001 ? (
											<VolumeX className="w-3.5 h-3.5" />
										) : previewVolume < 0.5 ? (
											<Volume1 className="w-3.5 h-3.5" />
										) : (
											<Volume2 className="w-3.5 h-3.5" />
										)}
									</button>
									<div className="relative flex h-7 w-24 select-none items-center overflow-hidden rounded-full border border-foreground/[0.06] bg-editor-bg/80 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]">
										<div
											className="absolute inset-y-[3px] left-[3px] right-auto rounded-[10px] bg-foreground/[0.08]"
											style={{
												width:
													previewVolume > 0
														? `max(calc(${previewVolume * 100}% - 6px), 1.2rem)`
														: 0,
											}}
										/>
										<div
											className="pointer-events-none absolute bottom-[18%] top-[18%] z-10 w-[2px] rounded-full bg-foreground/95 shadow-[0_0_10px_rgba(37,99,235,0.28)]"
											style={{ left: `calc(${previewVolume * 100}% - 8px)` }}
										/>
										<span className="pointer-events-none relative z-10 pl-2 text-[10px] font-medium text-muted-foreground">
											{Math.round(previewVolume * 100)}%
										</span>
										<input
											type="range"
											min="0"
											max="1"
											step="0.01"
											value={previewVolume}
											onChange={(e) =>
												setPreviewVolume(Number(e.target.value))
											}
											className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div
					className="flex-shrink-0 flex flex-col relative rounded-[24px] border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-[#110c22]/85 backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-2.5 overflow-hidden z-20 transition-colors duration-300"
					style={{
						height: timelineCollapsed ? undefined : `${timelineHeight}px`,
						minHeight: timelineCollapsed ? 0 : 140,
					}}
				>
					{/* Draggable resize bar at top edge of timeline */}
					{!timelineCollapsed && (
						<div
							className="absolute -top-1.5 left-0 right-0 h-3 z-40 cursor-ns-resize group flex items-center justify-center select-none"
							onPointerDown={handleTimelineResizeStart}
							title="Kéo lên/xuống để thay đổi độ cao timeline"
						>
							<div className="w-full h-[1px] bg-border/40 group-hover:bg-violet-500/60 group-active:bg-violet-500 transition-colors" />
							<div className="absolute w-12 h-1 rounded-full bg-muted-foreground/30 group-hover:bg-violet-500 group-hover:h-1.5 group-active:h-1.5 group-active:bg-violet-500 transition-all shadow-sm" />
						</div>
					)}
					<TimelineEditor
						ref={timelineRef}
						videoDuration={timelineDuration}
						currentTime={currentTime}
						playheadTime={
							savedPlayheadTimeRef.current !== null
								? mapSourceTimeToTimelineTime(savedPlayheadTimeRef.current * 1000) /
									1000
								: timelinePlayheadTime
						}
						onSeek={handleTimelineSeek}
						onHoverPreview={handleHoverPreview}
						videoPath={videoPath}
						videoSourcePath={videoSourcePath}
						cursorTelemetrySourcePath={cursorTelemetrySourcePath}
						cursorTelemetry={normalizedCursorTelemetry}
						autoSuggestZoomsTrigger={autoSuggestZoomsTrigger}
						onAutoSuggestZoomsConsumed={handleAutoSuggestZoomsConsumed}
						disableSuggestedZooms={!autoApplyFreshRecordingAutoZooms}
						zoomRegions={zoomRegions}
						panRegions={panRegions}
						onZoomAdded={handleZoomAdded}
						onZoomSuggested={handleZoomSuggested}
						onZoomSpanChange={handleZoomSpanChange}
						onZoomDelete={handleZoomDelete}
						onZoomDepthChange={handleZoomDepthChange}
						onZoomModeChange={handleZoomModeChange}
						onZoomPanChange={handleZoomPanChange}
						onZoomDuplicate={handleZoomDuplicate}
						selectedZoomId={selectedZoomId}
						onSelectZoom={handleSelectZoom}
						zoomsEnabled={zoomsEnabled}
						onToggleZooms={handleToggleZooms}
						onPanAdded={handlePanAdded}
						onPanSpanChange={handlePanSpanChange}
						onPanDelete={handlePanDelete}
						onPanDuplicate={handlePanDuplicate}
						selectedPanId={selectedPanId}
						onSelectPan={handleSelectPan}
						pansEnabled={pansEnabled}
						onTogglePans={handleTogglePans}
						trimRegions={trimRegions}
						clipRegions={clipRegions}
						onClipSplit={handleClipSplit}
						onClipSpanChange={handleClipSpanChange}
						onClipDelete={handleClipDelete}
						onClipDuplicate={handleClipDuplicate}
						selectedClipId={selectedClipId}
						onSelectClip={handleSelectClip}
						audioRegions={audioRegions}
						onAudioAdded={handleAudioAdded}
						onAudioSpanChange={handleAudioSpanChange}
						onAudioDelete={handleAudioDelete}
						onAudioDuplicate={handleAudioDuplicate}
						selectedAudioId={selectedAudioId}
						onSelectAudio={handleSelectAudio}
						onAudioSplit={handleSplitAudio}
						annotationRegions={annotationRegions}
						onAnnotationAdded={handleAnnotationAdded}
						onAnnotationSpanChange={handleAnnotationSpanChange}
						onAnnotationDelete={handleAnnotationDelete}
						onAnnotationDuplicate={handleAnnotationDuplicate}
						selectedAnnotationId={selectedAnnotationId}
						onSelectAnnotation={handleSelectAnnotation}
						showSourceAudioTrack={clipRegions.some((c) => c.showSourceAudio)}
						sourceAudioTrackSettings={audio.activeSourceAudioTrackSettings}
						getSourceAudioTrackSettingsForClip={
							audio.getSourceAudioTrackSettingsForClip
						}
						onSourceAudioAvailabilityChange={(available) => {
							setHasClipSourceAudio(available);
						}}
						onSourceAudioTracksMetaChange={(tracks) => {
							audio.onSourceAudioTracksMetaChange(tracks);
						}}
						zoomSpeed={zoomSpeed}
						onZoomSpeedChange={setZoomSpeed}
						onPanSpeedChange={handlePanSpeedChange}
					/>
				</div>
			</div>

			{showCropModal ? (
				<>
					<div
						className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
						onClick={handleCancelCropEditor}
					/>
					<div className="fixed left-1/2 top-1/2 z-[60] max-h-[94vh] w-[94vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-foreground/10 bg-editor-dialog p-6 shadow-2xl animate-in zoom-in-95 duration-200">
						<div className="mb-4 flex items-center justify-between">
							<div>
								<span className="text-xl font-bold text-foreground">
									{t("settings.crop.title", "Cắt Video")}
								</span>
								<p className="mt-1 text-sm text-muted-foreground">
									{t(
										"settings.crop.instruction",
										"Kéo các cạnh để thu hẹp vùng hiển thị video hoặc chọn tỉ lệ chuẩn bên dưới",
									)}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleCancelCropEditor}
								className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>
						<CropControl
							videoElement={videoPlaybackRef.current?.video || null}
							cropRegion={cropRegion}
							onCropChange={setCropRegion}
							aspectRatio={aspectRatio}
						/>
						<div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-4">
							<Button
								variant="ghost"
								onClick={() => setCropRegion({ x: 0, y: 0, width: 1, height: 1 })}
								className="text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5"
							>
								{t("settings.crop.reset", "Đặt lại toàn khung hình")}
							</Button>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									onClick={handleCancelCropEditor}
									className="border-foreground/10 text-xs hover:bg-foreground/5"
								>
									{t("common.actions.cancel", "Hủy")}
								</Button>
								<Button
									onClick={handleCloseCropEditor}
									size="default"
									className="bg-[#2563EB] text-white hover:bg-[#2563EB]/90 px-6 font-medium shadow-sm"
								>
									{t("common.actions.done", "Xong")}
								</Button>
							</div>
						</div>
					</div>
				</>
			) : null}

			{projectBrowser}
			{nativeCaptureUnavailableDialog}

			<LicenseModal
				open={licenseModalOpen}
				onOpenChange={setLicenseModalOpen}
				onLicenseChanged={setIsProUser}
			/>

			<RecordWebcamDialog
				open={recordWebcamDialogOpen}
				onOpenChange={setRecordWebcamDialogOpen}
				onRecordingComplete={handleWebcamRecorded}
			/>

			<Toaster className="pointer-events-auto" />
		</div>
	);
}
