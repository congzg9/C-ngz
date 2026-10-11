import type { Span } from "dnd-timeline";
import type { ForwardedRef, RefObject } from "react";
import { useCallback, useImperativeHandle } from "react";
import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	CursorTelemetryPoint,
	PanRegion,
	SpeedRegion,
	TrimRegion,
	ZoomFocus,
	ZoomRegion,
} from "../../types";
import type { TimelineShortcutBindings } from "../core/timelineTypes";
import type { TimelineEditorHandle } from "../TimelineEditor";
import { useTimelineAudioActions } from "./actions/useTimelineAudioActions";
import { useTimelinePanActions } from "./actions/useTimelinePanActions";
import { useTimelineZoomActions } from "./actions/useTimelineZoomActions";
import { useTimelineDndBindings } from "./useTimelineDndBindings";
import { useTimelineKeyboardShortcuts } from "./useTimelineKeyboardShortcuts";
import { useTimelineNormalization } from "./useTimelineNormalization";
import { useTimelineSelection } from "./useTimelineSelection";

interface UseTimelineEditorRuntimeParams {
	ref: ForwardedRef<TimelineEditorHandle>;
	videoDuration: number;
	totalMs: number;
	currentTimeMs: number;
	safeMinDurationMs: number;
	cursorTelemetry: CursorTelemetryPoint[];
	autoSuggestZoomsTrigger: number;
	onAutoSuggestZoomsConsumed?: () => void;
	disableSuggestedZooms: boolean;
	zoomRegions: ZoomRegion[];
	panRegions?: PanRegion[];
	onZoomAdded: (span: Span) => void;
	onPanAdded?: (span: Span) => void;
	onZoomSuggested?: (span: Span, focus: ZoomFocus) => void;
	onZoomSpanChange: (id: string, span: Span) => void;
	onPanSpanChange?: (id: string, span: Span) => void;
	onZoomDelete: (id: string) => void;
	onPanDelete?: (id: string) => void;
	selectedZoomId: string | null;
	selectedPanId?: string | null;
	onSelectZoom: (id: string | null) => void;
	onSelectPan?: (id: string | null) => void;
	trimRegions: TrimRegion[];
	onTrimSpanChange?: (id: string, span: Span) => void;
	clipRegions: ClipRegion[];
	onClipSplit?: (splitMs: number) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onClipDelete?: (id: string) => void;
	selectedClipId?: string | null;
	onSelectClip?: (id: string | null) => void;
	annotationRegions: AnnotationRegion[];
	onAnnotationAdded?: (span: Span, trackIndex?: number) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAnnotationDelete?: (id: string) => void;
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	speedRegions: SpeedRegion[];
	onSpeedSpanChange?: (id: string, span: Span) => void;
	audioRegions: AudioRegion[];
	onAudioAdded?: (span: Span, audioPath: string, trackIndex?: number) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAudioDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	onSelectAudio?: (id: string | null) => void;
	onAudioSplit?: (audioId: string, splitAtMs: number) => void;
	isMac: boolean;
	keyShortcuts: TimelineShortcutBindings;
	isTimelineFocusedRef: RefObject<boolean>;
	smartCameraEnabled?: boolean;
	onZoomDuplicate?: (id: string, span?: Span) => void;
	onPanDuplicate?: (id: string, span?: Span) => void;
	onClipDuplicate?: (id: string, span?: Span) => void;
	onAnnotationDuplicate?: (id: string, span?: Span, trackIndex?: number) => void;
	onAudioDuplicate?: (id: string, span?: Span, trackIndex?: number) => void;
}

export function useTimelineEditorRuntime({
	ref,
	videoDuration,
	totalMs,
	currentTimeMs,
	safeMinDurationMs,
	cursorTelemetry,
	autoSuggestZoomsTrigger,
	onAutoSuggestZoomsConsumed,
	disableSuggestedZooms,
	zoomRegions,
	panRegions = [],
	onZoomAdded,
	onPanAdded,
	onZoomSuggested,
	onZoomSpanChange,
	onPanSpanChange,
	onZoomDelete,
	onPanDelete,
	selectedZoomId,
	selectedPanId,
	onSelectZoom,
	onSelectPan,
	trimRegions,
	onTrimSpanChange,
	clipRegions,
	onClipSplit,
	onClipSpanChange,
	onClipDelete,
	selectedClipId,
	onSelectClip,
	annotationRegions,
	onAnnotationAdded,
	onAnnotationSpanChange,
	onAnnotationDelete,
	selectedAnnotationId,
	onSelectAnnotation,
	speedRegions,
	onSpeedSpanChange,
	audioRegions,
	onAudioAdded,
	onAudioSpanChange,
	onAudioDelete,
	selectedAudioId,
	onSelectAudio,
	onAudioSplit,
	isMac,
	keyShortcuts,
	isTimelineFocusedRef,
	smartCameraEnabled = false,
	onZoomDuplicate,
	onPanDuplicate,
	onClipDuplicate,
	onAnnotationDuplicate,
	onAudioDuplicate,
}: UseTimelineEditorRuntimeParams) {
	const {
		keyframes,
		selectedKeyframeId,
		setSelectedKeyframeId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		hasAnyTimelineBlocks,
		addKeyframe,
		deleteSelectedKeyframe,
		handleKeyframeMove,
		deleteSelectedZoom,
		deleteSelectedPan,
		deleteSelectedClip,
		deleteSelectedAnnotation,
		deleteSelectedAudio,
		clearSelectedBlocks,
		deleteAllBlocks,
		handleSelectZoom,
		handleSelectPan,
		handleSelectClip,
		handleSelectAnnotation,
		handleSelectAudio,
		cycleAnnotationsAtCurrentTime,
	} = useTimelineSelection({
		totalMs,
		currentTimeMs,
		zoomRegions,
		panRegions,
		clipRegions,
		annotationRegions,
		audioRegions,
		selectedZoomId,
		selectedPanId,
		selectedClipId,
		selectedAnnotationId,
		selectedAudioId,
		onZoomDelete,
		onPanDelete,
		onClipDelete,
		onAnnotationDelete,
		onAudioDelete,
		onSelectZoom,
		onSelectPan,
		onSelectClip,
		onSelectAnnotation,
		onSelectAudio,
	});

	useTimelineNormalization({
		totalMs,
		safeMinDurationMs,
		zoomRegions,
		panRegions,
		trimRegions,
		speedRegions,
		audioRegions,
		onZoomSpanChange,
		onPanSpanChange,
		onTrimSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
	});

	const {
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
		handleItemDuplicate,
	} = useTimelineDndBindings({
		zoomRegions,
		panRegions,
		trimRegions,
		clipRegions,
		annotationRegions,
		speedRegions,
		audioRegions,
		onZoomSpanChange,
		onPanSpanChange,
		onTrimSpanChange,
		onClipSpanChange,
		onAnnotationSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
		onZoomDuplicate,
		onPanDuplicate,
		onClipDuplicate,
		onAnnotationDuplicate,
		onAudioDuplicate,
	});

	const {
		defaultRegionDurationMs,
		canPlaceZoomAtMs,
		addZoomAtMs,
		handleAddZoom,
		handleSuggestZooms,
	} = useTimelineZoomActions({
		timeline: { videoDuration, totalMs, currentTimeMs },
		regions: { zoom: zoomRegions, clip: clipRegions },
		cursorTelemetry,
		options: { disableSuggestedZooms, smartCameraEnabled },
		autoSuggestZoomsTrigger,
		onAutoSuggestZoomsConsumed,
		onZoomAdded,
		onZoomSuggested,
	});

	const { canPlacePanAtMs, addPanAtMs, handleAddPan } = useTimelinePanActions({
		timeline: { videoDuration, totalMs, currentTimeMs },
		regions: { pan: panRegions, clip: clipRegions },
		onPanAdded,
	});

	const handleSplitClip = useCallback(
		(splitAtMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				return;
			}
			const targetMs = typeof splitAtMs === "number" ? splitAtMs : currentTimeMs;
			if (selectedAudioId && onAudioSplit) {
				onAudioSplit(selectedAudioId, targetMs);
				return;
			}
			if (!onClipSplit) {
				return;
			}
			onClipSplit(targetMs);
		},
		[videoDuration, totalMs, currentTimeMs, selectedAudioId, onAudioSplit, onClipSplit],
	);

	const { handleAddAudio } = useTimelineAudioActions({
		timeline: { videoDuration, totalMs, currentTimeMs },
		regions: { audio: audioRegions },
		onAudioAdded,
	});

	const handleAddAnnotation = useCallback(
		(trackIndex = 0) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAnnotationAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const latestStartPos = Math.max(0, totalMs - defaultDuration);
			const startPos = Math.max(0, Math.min(currentTimeMs, latestStartPos));
			const endPos = Math.min(startPos + defaultDuration, totalMs);
			onAnnotationAdded({ start: startPos, end: endPos }, trackIndex);
		},
		[videoDuration, totalMs, currentTimeMs, defaultRegionDurationMs, onAnnotationAdded],
	);

	useTimelineKeyboardShortcuts({
		isMac,
		keyShortcuts,
		isTimelineFocusedRef,
		hasAnyTimelineBlocks,
		annotationCount: annotationRegions.length,
		selectedKeyframeId,
		selectedZoomId,
		selectedPanId,
		selectedClipId,
		selectedAnnotationId,
		selectedAudioId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		setSelectedKeyframeId,
		addKeyframe,
		handleAddZoom,
		handleAddPan,
		handleSplitClip,
		handleAddAnnotation: () => handleAddAnnotation(),
		deleteAllBlocks,
		deleteSelectedKeyframe,
		deleteSelectedZoom,
		deleteSelectedPan,
		deleteSelectedClip,
		deleteSelectedAnnotation,
		deleteSelectedAudio,
		cycleAnnotationsAtCurrentTime,
		onZoomDuplicate: onZoomDuplicate ? (id: string) => onZoomDuplicate(id) : undefined,
		onPanDuplicate: onPanDuplicate ? (id: string) => onPanDuplicate(id) : undefined,
		onClipDuplicate: onClipDuplicate ? (id: string) => onClipDuplicate(id) : undefined,
		onAnnotationDuplicate: onAnnotationDuplicate
			? (id: string) => onAnnotationDuplicate(id)
			: undefined,
		onAudioDuplicate: onAudioDuplicate ? (id: string) => onAudioDuplicate(id) : undefined,
	});

	useImperativeHandle(
		ref,
		() => ({
			addZoom: handleAddZoom,
			addPan: handleAddPan,
			suggestZooms: handleSuggestZooms,
			splitClip: handleSplitClip,
			addAnnotation: handleAddAnnotation,
			addAudio: handleAddAudio,
			keyframes,
		}),
		[
			handleAddAnnotation,
			handleAddAudio,
			handleAddZoom,
			handleAddPan,
			handleSuggestZooms,
			handleSplitClip,
			keyframes,
		],
	);

	return {
		keyframes,
		selectedKeyframeId,
		setSelectedKeyframeId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		handleKeyframeMove,
		clearSelectedBlocks,
		handleSelectZoom,
		handleSelectPan,
		handleSelectClip,
		handleSelectAnnotation,
		handleSelectAudio,
		deleteSelectedPan,
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
		handleItemDuplicate,
		canPlaceZoomAtMs,
		addZoomAtMs,
		handleAddZoom,
		canPlacePanAtMs,
		addPanAtMs,
		handleAddPan,
		handleSuggestZooms,
		handleSplitClip,
		handleAddAudio,
		handleAddAnnotation,
	};
}
