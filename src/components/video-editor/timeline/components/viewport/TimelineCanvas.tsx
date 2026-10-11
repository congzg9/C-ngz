import {
	ArrowsOutCardinal,
	MagnifyingGlassPlus,
	MusicNotes,
	Plus,
	Scissors,
	TextT,
} from "@phosphor-icons/react";
import { useTimelineContext } from "dnd-timeline";
import {
	type MouseEvent,
	type MouseEventHandler,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	SourceAudioTrackSettings,
	SourceAudioTrackWithPeaks,
} from "@/components/video-editor/audio/audioTypes";
import type { PanSpeed, ZoomDepth, ZoomMode, ZoomSpeed } from "@/components/video-editor/types";
import { cn } from "@/lib/utils";
import { CLIP_ROW_ID, PAN_ROW_ID, SOURCE_AUDIO_ROW_ID, ZOOM_ROW_ID } from "../../core/constants";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../../core/rows";
import type { TimelineRenderItem } from "../../core/timelineTypes";
import { useTimelineAudioPeaks } from "../../hooks/useTimelineAudioPeaks";
import Item from "../../Item";
import glassStyles from "../../ItemGlass.module.css";
import Row from "../../Row";
import { getTimelineContentMinHeightPx } from "../../timelineLayout";
import ClipMarkerOverlay from "../overlays/ClipMarkerOverlay";
import { PanQuickPopover } from "../popovers/PanQuickPopover";
import { ZoomQuickPopover } from "../popovers/ZoomQuickPopover";

const HINT_CLIP = "Nhấn C hoặc S để cắt video";
const HINT_ANNOTATION = "Nhấn A để thêm chú thích";
const HINT_AUDIO = "Nhấn biểu tượng âm nhạc để thêm âm thanh";

interface TimelineCanvasProps {
	items: TimelineRenderItem[];
	videoDurationMs: number;
	currentTimeMs?: number;
	onSeek?: (time: number) => void;
	canPlaceZoomAtMs?: (startMs: number) => boolean;
	onSelectZoom?: (id: string | null) => void;
	/** Zoom track on/off (all zoom regions). Omit to hide the toggle. */
	zoomsEnabled?: boolean;
	onToggleZooms?: () => void;
	canPlacePanAtMs?: (startMs: number) => boolean;
	onSelectPan?: (id: string | null) => void;
	/** Pan track on/off (all pan regions). Omit to hide the toggle. */
	pansEnabled?: boolean;
	onTogglePans?: () => void;
	onSelectClip?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	onAddAnnotation?: (trackIndex?: number) => void;
	onAddAudio?: (trackIndex?: number) => void;
	onSplitClip?: (splitAtMs?: number) => void;
	onHoverPreview?: (time: number | null) => void;
	onAddZoomAtMs?: (startMs: number) => void;
	onAddPanAtMs?: (startMs: number) => void;
	selectedZoomId: string | null;
	selectedPanId?: string | null;
	onZoomDelete?: (id: string) => void;
	onPanDelete?: (id: string) => void;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	onZoomModeChange?: (mode: ZoomMode) => void;
	onZoomPanChange?: (pan: boolean) => void;
	onZoomDuplicate?: (id: string) => void;
	onPanDuplicate?: (id: string) => void;
	onPanSpeedChange?: (id: string, speed: PanSpeed) => void;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	selectAllBlocksActive?: boolean;
	onClearBlockSelection?: () => void;
	keyframes?: { id: string; time: number }[];
	sourceAudioTracks?: SourceAudioTrackWithPeaks[];
	getSourceAudioTrackSettingsForClip?: (clipId: string | null) => SourceAudioTrackSettings;
	showSourceAudioTrack?: boolean;
	liveSpanPreviewById?: Record<string, { start: number; end: number }>;
	liveHiddenItemIds?: string[];
	isLoading?: boolean;
	zoomSpeed?: ZoomSpeed;
	onZoomSpeedChange?: (speed: ZoomSpeed) => void;
}

interface TimelineHoverParams {
	direction: string;
	sidebarWidth: number;
	rangeStart: number;
	rangeEnd: number;
	videoDurationMs: number;
	zoomsEnabled?: boolean;
	pansEnabled?: boolean;
	onAddZoomAtMs?: (startMs: number) => void;
	onAddPanAtMs?: (startMs: number) => void;
	canPlaceZoomAtMs?: (startMs: number) => boolean;
	canPlacePanAtMs?: (startMs: number) => boolean;
	valueToPixels: (value: number) => number;
}

function useTimelineHover({
	direction,
	sidebarWidth,
	rangeStart,
	rangeEnd,
	videoDurationMs,
	zoomsEnabled = true,
	pansEnabled = true,
	onAddZoomAtMs,
	onAddPanAtMs,
	canPlaceZoomAtMs,
	canPlacePanAtMs,
	valueToPixels,
}: TimelineHoverParams) {
	const [isTimelineHovered, setIsTimelineHovered] = useState(false);
	const [timelineHoverMs, setTimelineHoverMs] = useState<number | null>(null);
	const [isZoomRowHovered, setIsZoomRowHovered] = useState(false);
	const [zoomRowHoverMs, setZoomRowHoverMs] = useState<number | null>(null);
	const [isPanRowHovered, setIsPanRowHovered] = useState(false);
	const [panRowHoverMs, setPanRowHoverMs] = useState<number | null>(null);

	const visibleDurationMs = Math.max(1, rangeEnd - rangeStart);

	const updateTimelineHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			const contentWidth = Math.max(1, rect.width - sidebarWidth);
			const contentX =
				direction === "rtl"
					? rect.right - sidebarWidth - clientX
					: clientX - rect.left - sidebarWidth;
			const clampedX = Math.max(0, Math.min(contentX, contentWidth));
			const ratio = clampedX / contentWidth;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setTimelineHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, sidebarWidth, videoDurationMs, visibleDurationMs],
	);

	const handleTimelineMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsTimelineHovered(true);
			updateTimelineHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateTimelineHoverTime],
	);

	const handleTimelineMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isTimelineHovered) setIsTimelineHovered(true);
			updateTimelineHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isTimelineHovered, updateTimelineHoverTime],
	);

	const handleTimelineMouseLeave = useCallback(() => {
		setIsTimelineHovered(false);
		setTimelineHoverMs(null);
		setIsZoomRowHovered(false);
		setZoomRowHoverMs(null);
		setIsPanRowHovered(false);
		setPanRowHoverMs(null);
	}, []);

	const updateZoomRowHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			if (rect.width <= 0) return;
			const position =
				direction === "rtl"
					? Math.max(0, Math.min(rect.right - clientX, rect.width))
					: Math.max(0, Math.min(clientX - rect.left, rect.width));
			const ratio = position / rect.width;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setZoomRowHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, videoDurationMs, visibleDurationMs],
	);

	const handleZoomRowMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsZoomRowHovered(true);
			updateZoomRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateZoomRowHoverTime],
	);

	const handleZoomRowMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isZoomRowHovered) setIsZoomRowHovered(true);
			updateZoomRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isZoomRowHovered, updateZoomRowHoverTime],
	);

	const handleZoomRowMouseLeave = useCallback(() => {
		setIsZoomRowHovered(false);
		setZoomRowHoverMs(null);
	}, []);

	const handleZoomRowMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const handleZoomRowClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (!zoomsEnabled || !onAddZoomAtMs || zoomRowHoverMs === null) return;
			const startMs = Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
			if (canPlaceZoomAtMs && !canPlaceZoomAtMs(startMs)) return;
			onAddZoomAtMs(startMs);
		},
		[canPlaceZoomAtMs, onAddZoomAtMs, videoDurationMs, zoomRowHoverMs, zoomsEnabled],
	);

	const updatePanRowHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			if (rect.width <= 0) return;
			const position =
				direction === "rtl"
					? Math.max(0, Math.min(rect.right - clientX, rect.width))
					: Math.max(0, Math.min(clientX - rect.left, rect.width));
			const ratio = position / rect.width;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setPanRowHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, videoDurationMs, visibleDurationMs],
	);

	const handlePanRowMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsPanRowHovered(true);
			updatePanRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updatePanRowHoverTime],
	);

	const handlePanRowMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isPanRowHovered) setIsPanRowHovered(true);
			updatePanRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isPanRowHovered, updatePanRowHoverTime],
	);

	const handlePanRowMouseLeave = useCallback(() => {
		setIsPanRowHovered(false);
		setPanRowHoverMs(null);
	}, []);

	const handlePanRowMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const handlePanRowClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (!pansEnabled || !onAddPanAtMs || panRowHoverMs === null) return;
			const startMs = Math.max(0, Math.min(panRowHoverMs, videoDurationMs));
			if (canPlacePanAtMs && !canPlacePanAtMs(startMs)) return;
			onAddPanAtMs(startMs);
		},
		[canPlacePanAtMs, onAddPanAtMs, videoDurationMs, panRowHoverMs, pansEnabled],
	);

	const ghostStartMs =
		zoomRowHoverMs === null ? null : Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
	const ghostDurationMs = Math.min(1000, videoDurationMs);
	const ghostEndMs =
		ghostStartMs === null
			? null
			: Math.max(ghostStartMs, Math.min(videoDurationMs, ghostStartMs + ghostDurationMs));
	const ghostStartOffsetPx =
		ghostStartMs === null ? 0 : valueToPixels(Math.max(0, ghostStartMs - rangeStart));
	const ghostEndOffsetPx =
		ghostEndMs === null ? 0 : valueToPixels(Math.max(0, ghostEndMs - rangeStart));
	const ghostWidthPx = Math.max(18, ghostEndOffsetPx - ghostStartOffsetPx);

	const ghostPanStartMs =
		panRowHoverMs === null ? null : Math.max(0, Math.min(panRowHoverMs, videoDurationMs));
	const ghostPanDurationMs = Math.min(1000, videoDurationMs);
	const ghostPanEndMs =
		ghostPanStartMs === null
			? null
			: Math.max(
					ghostPanStartMs,
					Math.min(videoDurationMs, ghostPanStartMs + ghostPanDurationMs),
				);
	const ghostPanStartOffsetPx =
		ghostPanStartMs === null ? 0 : valueToPixels(Math.max(0, ghostPanStartMs - rangeStart));
	const ghostPanEndOffsetPx =
		ghostPanEndMs === null ? 0 : valueToPixels(Math.max(0, ghostPanEndMs - rangeStart));
	const ghostPanWidthPx = Math.max(18, ghostPanEndOffsetPx - ghostPanStartOffsetPx);

	const timelineGhostOffsetPx =
		timelineHoverMs === null ? 0 : valueToPixels(Math.max(0, timelineHoverMs - rangeStart));
	const canShowGhostPlayhead = isTimelineHovered && timelineHoverMs !== null;
	const canShowGhostZoom =
		zoomsEnabled &&
		isZoomRowHovered &&
		ghostStartMs !== null &&
		(onAddZoomAtMs ? (canPlaceZoomAtMs?.(ghostStartMs) ?? true) : false);
	const canShowGhostPan =
		pansEnabled &&
		isPanRowHovered &&
		ghostPanStartMs !== null &&
		(onAddPanAtMs ? (canPlacePanAtMs?.(ghostPanStartMs) ?? true) : false);

	return {
		canShowGhostPlayhead,
		timelineGhostOffsetPx,
		handleTimelineMouseEnter,
		handleTimelineMouseMove,
		handleTimelineMouseLeave,
		canShowGhostZoom,
		ghostStartMs,
		ghostStartOffsetPx,
		ghostWidthPx,
		handleZoomRowMouseEnter,
		handleZoomRowMouseMove,
		handleZoomRowMouseLeave,
		handleZoomRowMouseDown,
		handleZoomRowClick,
		canShowGhostPan,
		ghostPanStartMs,
		ghostPanStartOffsetPx,
		ghostPanWidthPx,
		handlePanRowMouseEnter,
		handlePanRowMouseMove,
		handlePanRowMouseLeave,
		handlePanRowMouseDown,
		handlePanRowClick,
	};
}

interface TimelineCanvasRowsProps {
	items: TimelineRenderItem[];
	videoDurationMs: number;
	selectAllBlocksActive: boolean;
	selectedZoomId: string | null;
	selectedPanId?: string | null;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	onSelectZoom?: (id: string | null) => void;
	onSelectPan?: (id: string | null) => void;
	/** Zoom track on/off (all zoom regions). Omit to hide the toggle. */
	zoomsEnabled?: boolean;
	onToggleZooms?: () => void;
	/** Pan track on/off (all pan regions). Omit to hide the toggle. */
	pansEnabled?: boolean;
	onTogglePans?: () => void;
	onSelectClip?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	onAddAnnotation?: (trackIndex?: number) => void;
	onAddAudio?: (trackIndex?: number) => void;
	onSplitClip?: (splitAtMs?: number) => void;
	getClientXMs?: (clientX: number) => number;
	onHoverPreview?: (time: number | null) => void;
	sourceAudioTracks?: SourceAudioTrackWithPeaks[];
	getSourceAudioTrackSettingsForClip?: (clipId: string | null) => SourceAudioTrackSettings;
	showSourceAudioTrack?: boolean;
	liveSpanPreviewById?: Record<string, { start: number; end: number }>;
	liveHiddenItemIds?: string[];
	direction: string;
	rangeStart: number;
	valueToPixels: (value: number) => number;
	onZoomDelete?: (id: string) => void;
	onPanDelete?: (id: string) => void;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	onZoomModeChange?: (mode: ZoomMode) => void;
	onZoomPanChange?: (pan: boolean) => void;
	onZoomDuplicate?: (id: string) => void;
	onPanDuplicate?: (id: string) => void;
	onPanSpeedChange?: (id: string, speed: PanSpeed) => void;
	canShowGhostZoom: boolean;
	ghostStartMs: number | null;
	ghostStartOffsetPx: number;
	ghostWidthPx: number;
	onZoomRowMouseEnter: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseMove: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseLeave: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseDown: MouseEventHandler<HTMLDivElement>;
	onZoomRowClick: MouseEventHandler<HTMLDivElement>;
	canShowGhostPan: boolean;
	ghostPanStartMs: number | null;
	ghostPanStartOffsetPx: number;
	ghostPanWidthPx: number;
	onPanRowMouseEnter: MouseEventHandler<HTMLDivElement>;
	onPanRowMouseMove: MouseEventHandler<HTMLDivElement>;
	onPanRowMouseLeave: MouseEventHandler<HTMLDivElement>;
	onPanRowMouseDown: MouseEventHandler<HTMLDivElement>;
	onPanRowClick: MouseEventHandler<HTMLDivElement>;
	isLoading?: boolean;
	zoomSpeed?: ZoomSpeed;
	onZoomSpeedChange?: (speed: ZoomSpeed) => void;
	onSeekToClientX?: (clientX: number) => void;
}

interface AudioItemWithWaveformProps {
	item: TimelineRenderItem;
	span: { start: number; end: number };
	waveformSpan: { start: number; end: number };
	isSelected: boolean;
	onSelectAudio?: (id: string | null) => void;
	onSeekToClientX?: (clientX: number) => void;
}

function AudioItemWithWaveform({
	item,
	span,
	waveformSpan,
	isSelected,
	onSelectAudio,
	onSeekToClientX,
}: AudioItemWithWaveformProps) {
	const { peaks } = useTimelineAudioPeaks(item.audioPath ?? null);
	const normalizedWaveformSpan = useMemo(() => {
		const duration = Math.max(0, waveformSpan.end - waveformSpan.start);
		return { start: 0, end: duration };
	}, [waveformSpan.end, waveformSpan.start]);
	return (
		<Item
			id={item.id}
			rowId={item.rowId}
			span={span}
			isSelected={isSelected}
			onSelectId={onSelectAudio}
			variant="audio"
			waveformPeaks={peaks}
			waveformSegmentSpan={normalizedWaveformSpan}
			waveformGain={Math.max(0, Math.min(1, item.audioGain ?? 1))}
			waveformNormalize={Boolean(item.audioNormalize)}
			audioVolume={item.audioGain ?? 1}
			audioFadeInMs={item.audioFadeInMs}
			audioFadeOutMs={item.audioFadeOutMs}
			onSeekToClientX={onSeekToClientX}
		>
			{item.label}
		</Item>
	);
}

/** Track on/off switch pinned to the left edge of the zoom row. */
function ZoomTrackToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
	const label = enabled
		? "Track Zoom: Đang bật (Click để tắt)"
		: "Track Zoom: Đang tắt (Click để bật)";
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	return (
		<button
			type="button"
			role="switch"
			aria-checked={enabled}
			aria-label={label}
			title={label}
			onPointerDown={stop}
			onMouseDown={stop}
			onClick={(event) => {
				event.stopPropagation();
				onToggle();
			}}
			className={cn(
				"ml-0.5 flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-all",
				enabled
					? "border-violet-400/60 bg-violet-500 text-white hover:bg-violet-600"
					: "border-foreground/20 bg-background/80 text-foreground/45 hover:text-foreground/80 hover:bg-background",
			)}
		>
			<MagnifyingGlassPlus
				className={cn("h-3.5 w-3.5", !enabled && "opacity-40")}
				weight="bold"
			/>
		</button>
	);
}

/** Track on/off switch pinned to the left edge of the pan row. */
function PanTrackToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
	const label = enabled
		? "Track Pan: Đang bật (Click để tắt)"
		: "Track Pan: Đang tắt (Click để bật)";
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	return (
		<button
			type="button"
			role="switch"
			aria-checked={enabled}
			aria-label={label}
			title={label}
			onPointerDown={stop}
			onMouseDown={stop}
			onClick={(event) => {
				event.stopPropagation();
				onToggle();
			}}
			className={cn(
				"ml-0.5 flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-all",
				enabled
					? "border-emerald-400/60 bg-emerald-600 text-white hover:bg-emerald-700"
					: "border-foreground/20 bg-background/80 text-foreground/45 hover:text-foreground/80 hover:bg-background",
			)}
		>
			<ArrowsOutCardinal
				className={cn("h-3.5 w-3.5", !enabled && "opacity-40")}
				weight="bold"
			/>
		</button>
	);
}

/** Clip split button pinned to the left edge of the video clip row. */
function ClipSplitButton({ onSplit }: { onSplit: () => void }) {
	const label = "Cắt video tại vị trí con trỏ (C hoặc S)";
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onPointerDown={stop}
			onMouseDown={stop}
			onClick={(event) => {
				event.stopPropagation();
				onSplit();
			}}
			className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-sky-400/60 bg-sky-500 text-white shadow-sm transition-all hover:bg-sky-600 active:scale-95 dark:border-blue-500/60 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
		>
			<Scissors className="h-3.5 w-3.5" weight="bold" />
		</button>
	);
}

/** Track button pinned to the left edge of the annotation/text row. */
function AnnotationTrackBadge({ onAdd, trackIndex }: { onAdd?: () => void; trackIndex?: number }) {
	const label =
		typeof trackIndex === "number" && trackIndex > 0
			? `Thêm văn bản vào hàng ${trackIndex + 1}`
			: "Văn bản / Chú thích (Text)";
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onPointerDown={stop}
			onMouseDown={stop}
			onClick={(event) => {
				event.stopPropagation();
				onAdd?.();
			}}
			className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-violet-400/60 bg-violet-500 text-white shadow-sm transition-all hover:bg-violet-600 active:scale-95 dark:border-violet-500/60 dark:bg-violet-600 dark:hover:bg-violet-500 cursor-pointer"
		>
			<TextT className="h-3.5 w-3.5" weight="bold" />
		</button>
	);
}

/** Track button pinned to the left edge of the audio row. */
function AudioTrackBadge({
	onAdd,
	trackIndex,
	isLastTrack,
}: {
	onAdd?: () => void;
	trackIndex?: number;
	isLastTrack?: boolean;
}) {
	const label = isLastTrack
		? "Thêm hàng âm thanh mới"
		: typeof trackIndex === "number" && trackIndex > 0
			? `Thêm âm thanh vào hàng ${trackIndex + 1}`
			: "Âm thanh (Audio)";
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onPointerDown={stop}
			onMouseDown={stop}
			onClick={(event) => {
				event.stopPropagation();
				onAdd?.();
			}}
			className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-green-500/60 bg-green-600 text-white shadow-sm transition-all hover:bg-green-700 active:scale-95 dark:border-green-500/60 dark:bg-green-600 dark:hover:bg-green-500 cursor-pointer"
		>
			{isLastTrack ? (
				<Plus className="h-3.5 w-3.5" weight="bold" />
			) : (
				<MusicNotes className="h-3.5 w-3.5" weight="bold" />
			)}
		</button>
	);
}

const TimelineCanvasRows = memo(function TimelineCanvasRows({
	items,
	videoDurationMs,
	selectAllBlocksActive,
	selectedZoomId,
	selectedPanId,
	selectedClipId,
	selectedAnnotationId,
	selectedAudioId,
	onSelectZoom,
	onSelectPan,
	zoomsEnabled = true,
	onToggleZooms,
	pansEnabled = true,
	onTogglePans,
	onSelectClip,
	onSplitClip,
	getClientXMs,
	onHoverPreview,
	onSelectAnnotation,
	onSelectAudio,
	onAddAnnotation,
	onAddAudio,
	sourceAudioTracks = [],
	getSourceAudioTrackSettingsForClip,
	showSourceAudioTrack = false,
	liveSpanPreviewById,
	liveHiddenItemIds,
	direction,
	rangeStart,
	valueToPixels,
	onZoomDelete,
	onPanDelete,
	onZoomDepthChange,
	onZoomModeChange,
	onZoomPanChange,
	onZoomDuplicate,
	onPanDuplicate,
	onPanSpeedChange,
	canShowGhostZoom,
	ghostStartMs,
	ghostStartOffsetPx,
	ghostWidthPx,
	onZoomRowMouseEnter,
	onZoomRowMouseMove,
	onZoomRowMouseLeave,
	onZoomRowMouseDown,
	onZoomRowClick,
	canShowGhostPan,
	ghostPanStartMs,
	ghostPanStartOffsetPx,
	ghostPanWidthPx,
	onPanRowMouseEnter,
	onPanRowMouseMove,
	onPanRowMouseLeave,
	onPanRowMouseDown,
	onPanRowClick,
	isLoading = false,
	zoomSpeed,
	onZoomSpeedChange,
	onSeekToClientX,
}: TimelineCanvasRowsProps) {
	const hiddenIds = useMemo(() => new Set(liveHiddenItemIds ?? []), [liveHiddenItemIds]);
	const { clipItems, zoomItems, panItems, annotationRows, audioRows } = useMemo(() => {
		const nextClipItems: TimelineRenderItem[] = [];
		const nextZoomItems: TimelineRenderItem[] = [];
		const nextPanItems: TimelineRenderItem[] = [];
		const annotationBuckets = new Map<number, TimelineRenderItem[]>();
		const audioBuckets = new Map<number, TimelineRenderItem[]>();

		for (const item of items) {
			if (item.rowId === CLIP_ROW_ID) {
				nextClipItems.push(item);
				continue;
			}
			if (item.rowId === ZOOM_ROW_ID) {
				nextZoomItems.push(item);
				continue;
			}
			if (item.rowId === PAN_ROW_ID) {
				nextPanItems.push(item);
				continue;
			}
			if (isAnnotationTrackRowId(item.rowId)) {
				const trackIndex = getAnnotationTrackIndex(item.rowId);
				const bucket = annotationBuckets.get(trackIndex);
				if (bucket) bucket.push(item);
				else annotationBuckets.set(trackIndex, [item]);
				continue;
			}
			if (isAudioTrackRowId(item.rowId)) {
				const trackIndex = getAudioTrackIndex(item.rowId);
				const bucket = audioBuckets.get(trackIndex);
				if (bucket) bucket.push(item);
				else audioBuckets.set(trackIndex, [item]);
			}
		}

		let annotationRowsSorted: { rowId: string; items: TimelineRenderItem[] }[] = [];
		if (annotationBuckets.size > 0) {
			const maxAnnotationTrack = Math.max(0, ...Array.from(annotationBuckets.keys()));
			const totalAnnotationTracks = Math.max(1, maxAnnotationTrack + 2);
			annotationRowsSorted = Array.from(
				{ length: totalAnnotationTracks },
				(_, trackIndex) => ({
					rowId: getAnnotationTrackRowId(trackIndex),
					items: annotationBuckets.get(trackIndex) ?? [],
				}),
			);
		}

		let audioRowsSorted: { rowId: string; items: TimelineRenderItem[] }[] = [];
		if (audioBuckets.size > 0) {
			const maxAudioTrack = Math.max(0, ...Array.from(audioBuckets.keys()));
			const totalAudioTracks = Math.max(2, maxAudioTrack + 2);
			audioRowsSorted = Array.from({ length: totalAudioTracks }, (_, trackIndex) => ({
				rowId: getAudioTrackRowId(trackIndex),
				items: audioBuckets.get(trackIndex) ?? [],
			}));
		}

		return {
			clipItems: nextClipItems,
			zoomItems: nextZoomItems,
			panItems: nextPanItems,
			annotationRows: annotationRowsSorted,
			audioRows: audioRowsSorted,
		};
	}, [items]);

	const selectedZoomItem = useMemo(() => {
		if (!selectedZoomId) return null;
		return zoomItems.find((item) => item.id === selectedZoomId) ?? null;
	}, [selectedZoomId, zoomItems]);

	const selectedZoomCenterPx = useMemo(() => {
		if (!selectedZoomItem) return 0;
		const startPx = valueToPixels(Math.max(0, selectedZoomItem.span.start - rangeStart));
		const endPx = valueToPixels(Math.max(0, selectedZoomItem.span.end - rangeStart));
		return startPx + (endPx - startPx) / 2;
	}, [rangeStart, selectedZoomItem, valueToPixels]);

	const selectedPanItem = useMemo(() => {
		if (!selectedPanId) return null;
		return panItems.find((item) => item.id === selectedPanId) ?? null;
	}, [selectedPanId, panItems]);

	const selectedPanCenterPx = useMemo(() => {
		if (!selectedPanItem) return 0;
		const startPx = valueToPixels(Math.max(0, selectedPanItem.span.start - rangeStart));
		const endPx = valueToPixels(Math.max(0, selectedPanItem.span.end - rangeStart));
		return startPx + (endPx - startPx) / 2;
	}, [rangeStart, selectedPanItem, valueToPixels]);

	const scrubRafRef = useRef<number | null>(null);

	const updateClipHover = useCallback(
		(clientX: number) => {
			if (!getClientXMs) return;
			const ms = getClientXMs(clientX);

			if (onHoverPreview) {
				if (scrubRafRef.current === null) {
					scrubRafRef.current = requestAnimationFrame(() => {
						scrubRafRef.current = null;
						onHoverPreview(ms / 1000);
					});
				}
			}
		},
		[getClientXMs, onHoverPreview],
	);

	const handleClipRowMouseLeave = useCallback(() => {
		if (onHoverPreview) {
			if (scrubRafRef.current !== null) {
				cancelAnimationFrame(scrubRafRef.current);
				scrubRafRef.current = null;
			}
			onHoverPreview(null);
		}
	}, [onHoverPreview]);

	return (
		<>
			<Row
				id={CLIP_ROW_ID}
				isEmpty={clipItems.length === 0}
				hint={HINT_CLIP}
				leading={
					onSplitClip ? <ClipSplitButton onSplit={() => onSplitClip()} /> : undefined
				}
				contentClassName="cursor-default"
				onMouseMove={(e) => updateClipHover(e.clientX)}
				onMouseLeave={handleClipRowMouseLeave}
				onClick={(e) => onSeekToClientX?.(e.clientX)}
			>
				<ClipMarkerOverlay videoDurationMs={videoDurationMs} />
				{clipItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectAllBlocksActive || item.id === selectedClipId}
						onSelectId={onSelectClip}
						variant="clip"
						isLoading={isLoading}
						loadingLabel="Analyzing..."
						onSeekToClientX={onSeekToClientX}
						onHoverClientX={updateClipHover}
					>
						{item.label}
					</Item>
				))}
			</Row>
			{showSourceAudioTrack &&
				sourceAudioTracks.map((track) => (
					<Row
						key={track.id}
						id={`${SOURCE_AUDIO_ROW_ID}-${track.id}`}
						leading={<AudioTrackBadge />}
					>
						{clipItems
							.filter((item) => item.showSourceAudio)
							.map((item) => {
								const settings = getSourceAudioTrackSettingsForClip?.(item.id)?.[
									track.id
								] ?? { volume: 1, normalize: false };
								return (
									<Item
										key={`source-audio-${track.id}-${item.id}`}
										id={`source-audio-${track.id}-${item.id}`}
										rowId={`${SOURCE_AUDIO_ROW_ID}-${track.id}`}
										span={liveSpanPreviewById?.[item.id] ?? item.span}
										disabled
										isSelected={
											selectAllBlocksActive || item.id === selectedClipId
										}
										onSelect={() => onSelectClip?.(item.id)}
										variant="audio"
										waveformPeaks={track.peaks}
										waveformSegmentSpan={item.sourceSpan ?? item.span}
										waveformGain={Math.max(0, Math.min(1, settings.volume))}
										waveformNormalize={Boolean(settings.normalize)}
										audioVolume={Math.max(0, Math.min(1, settings.volume))}
										muted={item.muted}
										onSeekToClientX={onSeekToClientX}
									>
										{track.label}
									</Item>
								);
							})}
					</Row>
				))}

			<Row
				id={ZOOM_ROW_ID}
				leading={
					onToggleZooms ? (
						<ZoomTrackToggle enabled={zoomsEnabled} onToggle={onToggleZooms} />
					) : undefined
				}
				className={cn("transition-opacity duration-300", !zoomsEnabled && "opacity-80")}
				contentClassName={cn(
					"cursor-default transition-all duration-300",
					!zoomsEnabled &&
						"opacity-50 grayscale-[50%] pointer-events-none cursor-not-allowed",
				)}
				overlay={
					selectedZoomItem &&
					zoomsEnabled &&
					onZoomDepthChange &&
					onZoomModeChange &&
					onZoomDelete ? (
						<ZoomQuickPopover
							id={selectedZoomItem.id}
							span={selectedZoomItem.span}
							depth={(selectedZoomItem.zoomDepth ?? 2) as ZoomDepth}
							mode={(selectedZoomItem.zoomMode ?? "auto") as ZoomMode}
							pan={selectedZoomItem.pan}
							centerPx={selectedZoomCenterPx}
							onDepthChange={onZoomDepthChange}
							onModeChange={onZoomModeChange}
							onPanChange={onZoomPanChange}
							onDuplicate={onZoomDuplicate}
							onDelete={onZoomDelete}
							onClose={() => onSelectZoom?.(null)}
							zoomSpeed={zoomSpeed}
							onZoomSpeedChange={onZoomSpeedChange}
						/>
					) : undefined
				}
				isEmpty={zoomItems.length === 0}
				onMouseEnter={onZoomRowMouseEnter}
				onMouseMove={onZoomRowMouseMove}
				onMouseLeave={onZoomRowMouseLeave}
				onMouseDown={onZoomRowMouseDown}
				onClick={onZoomRowClick}
			>
				{canShowGhostZoom && ghostStartMs !== null && (
					<div className="absolute inset-0 z-[3] pointer-events-none">
						<div
							className="absolute top-1/2 -translate-y-1/2 h-[85%] min-h-[22px]"
							style={
								direction === "rtl"
									? {
											right: `${ghostStartOffsetPx}px`,
											width: `${ghostWidthPx}px`,
										}
									: {
											left: `${ghostStartOffsetPx}px`,
											width: `${ghostWidthPx}px`,
										}
							}
						>
							<div
								className={cn(
									glassStyles.glassPurple,
									"w-full h-full overflow-hidden flex items-center justify-center cursor-default relative opacity-80",
								)}
							>
								<div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
								<div className={cn(glassStyles.zoomEndCap, glassStyles.right)} />
								<div className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/45 bg-white/15 text-white">
									<Plus className="h-2.5 w-2.5" />
								</div>
							</div>
						</div>
					</div>
				)}
				{zoomItems
					.filter((item) => !hiddenIds.has(item.id))
					.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={selectAllBlocksActive || item.id === selectedZoomId}
							onSelectId={onSelectZoom}
							zoomDepth={item.zoomDepth}
							zoomMode={item.zoomMode}
							variant="zoom"
							muted={!zoomsEnabled}
							disabled={!zoomsEnabled}
							onSeekToClientX={onSeekToClientX}
						>
							{item.label}
						</Item>
					))}
			</Row>

			<Row
				id={PAN_ROW_ID}
				leading={
					onTogglePans ? (
						<PanTrackToggle enabled={pansEnabled} onToggle={onTogglePans} />
					) : undefined
				}
				className={cn("transition-opacity duration-300", !pansEnabled && "opacity-80")}
				contentClassName={cn(
					"cursor-default transition-all duration-300",
					!pansEnabled &&
						"opacity-50 grayscale-[50%] pointer-events-none cursor-not-allowed",
				)}
				overlay={
					selectedPanItem && pansEnabled && onPanDelete ? (
						<PanQuickPopover
							id={selectedPanItem.id}
							span={selectedPanItem.span}
							speed={selectedPanItem.speedValue as PanSpeed | undefined}
							centerPx={selectedPanCenterPx}
							onSpeedChange={(speed) => onPanSpeedChange?.(selectedPanItem.id, speed)}
							onDuplicate={onPanDuplicate}
							onDelete={onPanDelete}
							onClose={() => onSelectPan?.(null)}
						/>
					) : undefined
				}
				isEmpty={panItems.length === 0}
				onMouseEnter={onPanRowMouseEnter}
				onMouseMove={onPanRowMouseMove}
				onMouseLeave={onPanRowMouseLeave}
				onMouseDown={onPanRowMouseDown}
				onClick={onPanRowClick}
			>
				{canShowGhostPan && ghostPanStartMs !== null && (
					<div className="absolute inset-0 z-[3] pointer-events-none">
						<div
							className="absolute top-1/2 -translate-y-1/2 h-[85%] min-h-[22px]"
							style={
								direction === "rtl"
									? {
											right: `${ghostPanStartOffsetPx}px`,
											width: `${ghostPanWidthPx}px`,
										}
									: {
											left: `${ghostPanStartOffsetPx}px`,
											width: `${ghostPanWidthPx}px`,
										}
							}
						>
							<div
								className={cn(
									glassStyles.glassEmerald,
									"w-full h-full overflow-hidden flex items-center justify-center cursor-default relative opacity-80",
								)}
							>
								<div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
								<div className={cn(glassStyles.zoomEndCap, glassStyles.right)} />
								<div className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/45 bg-white/15 text-white">
									<Plus className="h-2.5 w-2.5" />
								</div>
							</div>
						</div>
					</div>
				)}
				{panItems
					.filter((item) => !hiddenIds.has(item.id))
					.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={selectAllBlocksActive || item.id === selectedPanId}
							onSelectId={onSelectPan}
							variant="pan"
							muted={!pansEnabled}
							disabled={!pansEnabled}
							onSeekToClientX={onSeekToClientX}
						>
							{item.label}
						</Item>
					))}
			</Row>

			{annotationRows.map(({ rowId, items: rowItems }, index) => (
				<Row
					key={rowId}
					id={rowId}
					leading={
						<AnnotationTrackBadge
							trackIndex={index}
							onAdd={() => onAddAnnotation?.(index)}
						/>
					}
					isEmpty={rowItems.length === 0}
					hint={index === 0 ? HINT_ANNOTATION : undefined}
				>
					{rowItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={selectAllBlocksActive || item.id === selectedAnnotationId}
							onSelectId={onSelectAnnotation}
							variant="annotation"
							onSeekToClientX={onSeekToClientX}
						>
							{item.label}
						</Item>
					))}
				</Row>
			))}

			{audioRows.map(({ rowId, items: rowItems }, index) => {
				const isLastTrack = index === audioRows.length - 1;
				return (
					<Row
						key={rowId}
						id={rowId}
						leading={
							<AudioTrackBadge
								trackIndex={index}
								isLastTrack={isLastTrack}
								onAdd={() => onAddAudio?.(index)}
							/>
						}
						isEmpty={rowItems.length === 0}
						hint={rowItems.length === 0 && index === 0 ? HINT_AUDIO : undefined}
						className={cn(
							rowItems.length === 0 &&
								"border border-dashed border-border/30 rounded-lg",
						)}
					>
						{rowItems.map((item) => (
							<AudioItemWithWaveform
								key={item.id}
								item={item}
								span={item.span}
								waveformSpan={liveSpanPreviewById?.[item.id] ?? item.span}
								isSelected={selectAllBlocksActive || item.id === selectedAudioId}
								onSelectAudio={onSelectAudio}
								onSeekToClientX={onSeekToClientX}
							/>
						))}
					</Row>
				);
			})}
		</>
	);
});

function TimelineCanvas({
	items,
	videoDurationMs,
	currentTimeMs: _currentTimeMs,
	onSeek,
	onAddZoomAtMs,
	canPlaceZoomAtMs,
	onSelectZoom,
	zoomsEnabled = true,
	onToggleZooms,
	onSelectClip,
	onSplitClip,
	onHoverPreview,
	onSelectAnnotation,
	onSelectAudio,
	onAddAnnotation,
	onAddAudio,
	selectedZoomId,
	onZoomDelete,
	onZoomDepthChange,
	onZoomModeChange,
	onZoomPanChange,
	onZoomDuplicate,
	selectedClipId,
	selectedAnnotationId,
	selectedAudioId,
	selectAllBlocksActive = false,
	onClearBlockSelection,
	keyframes: _keyframes = [],
	sourceAudioTracks = [],
	getSourceAudioTrackSettingsForClip,
	showSourceAudioTrack = false,
	liveSpanPreviewById,
	liveHiddenItemIds,
	isLoading = false,
	zoomSpeed,
	onZoomSpeedChange,
	selectedPanId,
	onSelectPan,
	pansEnabled = true,
	onTogglePans,
	onPanDelete,
	onPanDuplicate,
	onPanSpeedChange,
	onAddPanAtMs,
	canPlacePanAtMs,
}: TimelineCanvasProps) {
	const { setTimelineRef, style, sidebarWidth, direction, range, valueToPixels, pixelsToValue } =
		useTimelineContext();
	const localTimelineRef = useRef<HTMLDivElement | null>(null);
	const [isSeeking, setIsSeeking] = useState(false);
	const seekRafRef = useRef<number | null>(null);
	const pendingSeekClientXRef = useRef<number | null>(null);

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			setTimelineRef(node);
			localTimelineRef.current = node;
		},
		[setTimelineRef],
	);

	const handleTimelineClick = useCallback(
		(e: MouseEvent<HTMLDivElement>) => {
			if (isSeeking) return;
			if (!onSeek || videoDurationMs <= 0) return;

			if (onClearBlockSelection) {
				onClearBlockSelection();
			} else {
				onSelectZoom?.(null);
				onSelectPan?.(null);
				onSelectClip?.(null);
				onSelectAnnotation?.(null);
				onSelectAudio?.(null);
			}

			const rect = e.currentTarget.getBoundingClientRect();
			const clickX =
				direction === "rtl"
					? rect.right - sidebarWidth - e.clientX
					: e.clientX - rect.left - sidebarWidth;
			if (clickX < 0) return;
			const relativeMs = pixelsToValue(clickX);
			const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
			onSeek(absoluteMs / 1000);
		},
		[
			isSeeking,
			onSeek,
			onSelectZoom,
			onSelectPan,
			onSelectClip,
			onSelectAnnotation,
			onSelectAudio,
			onClearBlockSelection,
			videoDurationMs,
			sidebarWidth,
			direction,
			range.start,
			pixelsToValue,
		],
	);

	const getAbsoluteMsFromClientX = useCallback(
		(clientX: number, rect: DOMRect) => {
			const clickX =
				direction === "rtl"
					? rect.right - sidebarWidth - clientX
					: clientX - rect.left - sidebarWidth;
			const relativeMs = pixelsToValue(clickX);
			return Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
		},
		[direction, pixelsToValue, range.start, sidebarWidth, videoDurationMs],
	);

	const handleSeekToClientX = useCallback(
		(clientX: number) => {
			if (!onSeek || !localTimelineRef.current || videoDurationMs <= 0) return;
			const rect = localTimelineRef.current.getBoundingClientRect();
			const ms = getAbsoluteMsFromClientX(clientX, rect);
			onSeek(ms / 1000);
		},
		[getAbsoluteMsFromClientX, onSeek, videoDurationMs],
	);

	const getClientXMs = useCallback(
		(clientX: number) => {
			if (!localTimelineRef.current || videoDurationMs <= 0) return 0;
			const rect = localTimelineRef.current.getBoundingClientRect();
			return getAbsoluteMsFromClientX(clientX, rect);
		},
		[getAbsoluteMsFromClientX, videoDurationMs],
	);

	const handleTimelineMouseDown = useCallback(
		(e: MouseEvent<HTMLDivElement>) => {
			if (e.button !== 0 || !onSeek || videoDurationMs <= 0 || !localTimelineRef.current)
				return;
			if ((e.target as HTMLElement).closest("[data-timeline-item]")) {
				return;
			}

			if (onClearBlockSelection) {
				onClearBlockSelection();
			} else {
				onSelectZoom?.(null);
				onSelectPan?.(null);
				onSelectClip?.(null);
				onSelectAnnotation?.(null);
				onSelectAudio?.(null);
			}

			const rect = localTimelineRef.current.getBoundingClientRect();
			onSeek(getAbsoluteMsFromClientX(e.clientX, rect) / 1000);
			setIsSeeking(true);
			e.preventDefault();
		},
		[
			getAbsoluteMsFromClientX,
			onClearBlockSelection,
			onSeek,
			onSelectAnnotation,
			onSelectAudio,
			onSelectClip,
			onSelectPan,
			onSelectZoom,
			videoDurationMs,
		],
	);

	useEffect(() => {
		if (!isSeeking) return;

		const flushSeek = () => {
			seekRafRef.current = null;
			if (!onSeek || !localTimelineRef.current || pendingSeekClientXRef.current === null)
				return;
			const rect = localTimelineRef.current.getBoundingClientRect();
			onSeek(getAbsoluteMsFromClientX(pendingSeekClientXRef.current, rect) / 1000);
		};

		const handleMouseMove = (event: globalThis.MouseEvent) => {
			pendingSeekClientXRef.current = event.clientX;
			if (seekRafRef.current === null) {
				seekRafRef.current = requestAnimationFrame(flushSeek);
			}
		};

		const handleMouseUp = () => {
			if (seekRafRef.current !== null) {
				cancelAnimationFrame(seekRafRef.current);
				seekRafRef.current = null;
			}
			if (pendingSeekClientXRef.current !== null) {
				flushSeek();
			}
			pendingSeekClientXRef.current = null;
			setIsSeeking(false);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			if (seekRafRef.current !== null) {
				cancelAnimationFrame(seekRafRef.current);
				seekRafRef.current = null;
			}
			pendingSeekClientXRef.current = null;
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [getAbsoluteMsFromClientX, isSeeking, onSeek]);

	const timelineRowCount = useMemo(() => {
		let maxAnnotationTrackIndex = -1;
		let hasAnnotation = false;
		let maxAudioTrackIndex = -1;
		let hasAudio = false;

		for (const item of items) {
			if (isAnnotationTrackRowId(item.rowId)) {
				hasAnnotation = true;
				const idx = getAnnotationTrackIndex(item.rowId);
				if (idx > maxAnnotationTrackIndex) maxAnnotationTrackIndex = idx;
			}
			if (isAudioTrackRowId(item.rowId)) {
				hasAudio = true;
				const idx = getAudioTrackIndex(item.rowId);
				if (idx > maxAudioTrackIndex) maxAudioTrackIndex = idx;
			}
		}

		const annotationRowCount = hasAnnotation ? Math.max(1, maxAnnotationTrackIndex + 2) : 0;
		const audioRowCount = hasAudio ? Math.max(2, maxAudioTrackIndex + 2) : 0;
		const sourceAudioRows = showSourceAudioTrack ? sourceAudioTracks.length : 0;
		return 3 + sourceAudioRows + annotationRowCount + audioRowCount;
	}, [items, showSourceAudioTrack, sourceAudioTracks.length]);
	const timelineContentMinHeightPx = getTimelineContentMinHeightPx(timelineRowCount);
	const {
		handleTimelineMouseEnter,
		handleTimelineMouseMove,
		handleTimelineMouseLeave,
		canShowGhostZoom,
		ghostStartMs,
		ghostStartOffsetPx,
		ghostWidthPx,
		handleZoomRowMouseEnter,
		handleZoomRowMouseMove,
		handleZoomRowMouseLeave,
		handleZoomRowMouseDown,
		handleZoomRowClick,
		canShowGhostPan,
		ghostPanStartMs,
		ghostPanStartOffsetPx,
		ghostPanWidthPx,
		handlePanRowMouseEnter,
		handlePanRowMouseMove,
		handlePanRowMouseLeave,
		handlePanRowMouseDown,
		handlePanRowClick,
	} = useTimelineHover({
		direction,
		sidebarWidth,
		rangeStart: range.start,
		rangeEnd: range.end,
		videoDurationMs,
		zoomsEnabled,
		pansEnabled,
		onAddZoomAtMs,
		onAddPanAtMs,
		canPlaceZoomAtMs,
		canPlacePanAtMs,
		valueToPixels,
	});

	return (
		<div
			ref={setRefs}
			style={{
				...style,
				minHeight: "100%",
				height:
					timelineContentMinHeightPx > 0
						? `max(100%, ${timelineContentMinHeightPx}px)`
						: "100%",
			}}
			className="select-none bg-editor-bg relative cursor-default group flex flex-col"
			onMouseDown={handleTimelineMouseDown}
			onClick={handleTimelineClick}
			onMouseEnter={handleTimelineMouseEnter}
			onMouseMove={handleTimelineMouseMove}
			onMouseLeave={handleTimelineMouseLeave}
		>
			<div className="relative z-10 flex flex-col">
				<TimelineCanvasRows
					items={items}
					videoDurationMs={videoDurationMs}
					selectAllBlocksActive={selectAllBlocksActive}
					selectedZoomId={selectedZoomId}
					selectedPanId={selectedPanId}
					selectedClipId={selectedClipId}
					selectedAnnotationId={selectedAnnotationId}
					selectedAudioId={selectedAudioId}
					onSelectZoom={onSelectZoom}
					onSelectPan={onSelectPan}
					zoomsEnabled={zoomsEnabled}
					onToggleZooms={onToggleZooms}
					pansEnabled={pansEnabled}
					onTogglePans={onTogglePans}
					onSeekToClientX={handleSeekToClientX}
					onSelectClip={onSelectClip}
					onSplitClip={onSplitClip}
					getClientXMs={getClientXMs}
					onHoverPreview={onHoverPreview}
					onSelectAnnotation={onSelectAnnotation}
					onSelectAudio={onSelectAudio}
					onAddAnnotation={onAddAnnotation}
					onAddAudio={onAddAudio}
					sourceAudioTracks={sourceAudioTracks}
					getSourceAudioTrackSettingsForClip={getSourceAudioTrackSettingsForClip}
					showSourceAudioTrack={showSourceAudioTrack}
					liveSpanPreviewById={liveSpanPreviewById}
					liveHiddenItemIds={liveHiddenItemIds}
					direction={direction}
					rangeStart={range.start}
					valueToPixels={valueToPixels}
					onZoomDelete={onZoomDelete}
					onPanDelete={onPanDelete}
					onZoomDepthChange={onZoomDepthChange}
					onZoomModeChange={onZoomModeChange}
					onZoomPanChange={onZoomPanChange}
					onZoomDuplicate={onZoomDuplicate}
					onPanDuplicate={onPanDuplicate}
					onPanSpeedChange={onPanSpeedChange}
					canShowGhostZoom={canShowGhostZoom}
					ghostStartMs={ghostStartMs}
					ghostStartOffsetPx={ghostStartOffsetPx}
					ghostWidthPx={ghostWidthPx}
					onZoomRowMouseEnter={handleZoomRowMouseEnter}
					onZoomRowMouseMove={handleZoomRowMouseMove}
					onZoomRowMouseLeave={handleZoomRowMouseLeave}
					onZoomRowMouseDown={handleZoomRowMouseDown}
					onZoomRowClick={handleZoomRowClick}
					canShowGhostPan={canShowGhostPan}
					ghostPanStartMs={ghostPanStartMs}
					ghostPanStartOffsetPx={ghostPanStartOffsetPx}
					ghostPanWidthPx={ghostPanWidthPx}
					onPanRowMouseEnter={handlePanRowMouseEnter}
					onPanRowMouseMove={handlePanRowMouseMove}
					onPanRowMouseLeave={handlePanRowMouseLeave}
					onPanRowMouseDown={handlePanRowMouseDown}
					onPanRowClick={handlePanRowClick}
					isLoading={isLoading}
					zoomSpeed={zoomSpeed}
					onZoomSpeedChange={onZoomSpeedChange}
				/>
			</div>
		</div>
	);
}

export default memo(TimelineCanvas);
