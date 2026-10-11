import type { Span } from "dnd-timeline";
import { useCallback, useMemo } from "react";
import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	PanRegion,
	SpeedRegion,
	TrimRegion,
	ZoomRegion,
} from "../../types";
import {
	getAnnotationTrackIndex,
	getAudioTrackIndex,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../core/rows";
import { spansOverlap } from "../core/spans";
import type { TimelineRenderItem } from "../core/timelineTypes";
import { buildAllRegionSpans, buildTimelineItems, resolveDropRowId } from "../model/timelineModel";

interface UseTimelineDndBindingsParams {
	zoomRegions: ZoomRegion[];
	panRegions?: PanRegion[];
	trimRegions: TrimRegion[];
	clipRegions: ClipRegion[];
	annotationRegions: AnnotationRegion[];
	speedRegions: SpeedRegion[];
	audioRegions: AudioRegion[];
	onZoomSpanChange: (id: string, span: Span) => void;
	onPanSpanChange?: (id: string, span: Span) => void;
	onTrimSpanChange?: (id: string, span: Span) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onSpeedSpanChange?: (id: string, span: Span) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onZoomDuplicate?: (id: string, span?: Span) => void;
	onPanDuplicate?: (id: string, span?: Span) => void;
	onClipDuplicate?: (id: string, span?: Span) => void;
	onAnnotationDuplicate?: (id: string, span?: Span, trackIndex?: number) => void;
	onAudioDuplicate?: (id: string, span?: Span, trackIndex?: number) => void;
}

type TimelineItemKind = "zoom" | "pan" | "trim" | "clip" | "annotation" | "speed" | "audio" | null;

export function useTimelineDndBindings({
	zoomRegions,
	panRegions = [],
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
}: UseTimelineDndBindingsParams) {
	const resolveItemKind = useCallback(
		(id: string): TimelineItemKind => {
			if (zoomRegions.some((r) => r.id === id)) return "zoom";
			if (panRegions.some((r) => r.id === id)) return "pan";
			if (trimRegions.some((r) => r.id === id)) return "trim";
			if (clipRegions.some((r) => r.id === id)) return "clip";
			if (annotationRegions.some((r) => r.id === id)) return "annotation";
			if (speedRegions.some((r) => r.id === id)) return "speed";
			if (audioRegions.some((r) => r.id === id)) return "audio";
			return null;
		},
		[
			zoomRegions,
			panRegions,
			trimRegions,
			clipRegions,
			annotationRegions,
			speedRegions,
			audioRegions,
		],
	);

	const resolveTrackIndex = useCallback(
		(kind: "annotation" | "audio", id: string, rowId?: string): number => {
			if (kind === "annotation") {
				return rowId && isAnnotationTrackRowId(rowId)
					? getAnnotationTrackIndex(rowId)
					: (annotationRegions.find((region) => region.id === id)?.trackIndex ?? 0);
			}
			return rowId && isAudioTrackRowId(rowId)
				? getAudioTrackIndex(rowId)
				: (audioRegions.find((region) => region.id === id)?.trackIndex ?? 0);
		},
		[annotationRegions, audioRegions],
	);

	const hasOverlap = useCallback(
		(newSpan: Span, excludeId?: string, rowId?: string, includeSelf?: boolean): boolean => {
			if (!excludeId) return false;
			const itemKind = resolveItemKind(excludeId);

			if (itemKind === "annotation") return false;

			const checkOverlap = (
				regions: (
					| ZoomRegion
					| PanRegion
					| TrimRegion
					| ClipRegion
					| SpeedRegion
					| AudioRegion
				)[],
			) =>
				regions.some((region) => {
					if (!includeSelf && region.id === excludeId) return false;
					return spansOverlap(newSpan, { start: region.startMs, end: region.endMs });
				});

			if (itemKind === "zoom") return checkOverlap(zoomRegions);
			if (itemKind === "pan") return checkOverlap(panRegions);
			if (itemKind === "trim") return checkOverlap(trimRegions);
			if (itemKind === "clip") return checkOverlap(clipRegions);
			if (itemKind === "speed") return checkOverlap(speedRegions);

			if (itemKind === "audio") {
				const activeTrackIndex = resolveTrackIndex("audio", excludeId, rowId);
				return checkOverlap(
					audioRegions.filter((region) => (region.trackIndex ?? 0) === activeTrackIndex),
				);
			}

			return false;
		},
		[
			resolveItemKind,
			resolveTrackIndex,
			zoomRegions,
			panRegions,
			trimRegions,
			clipRegions,
			audioRegions,
			speedRegions,
		],
	);

	const timelineItems = useMemo<TimelineRenderItem[]>(
		() =>
			buildTimelineItems({
				zoomRegions,
				panRegions,
				clipRegions,
				annotationRegions,
				audioRegions,
			}),
		[zoomRegions, panRegions, clipRegions, annotationRegions, audioRegions],
	);

	const allRegionSpans = useMemo(
		() =>
			buildAllRegionSpans({
				zoomRegions,
				panRegions,
				clipRegions,
				audioRegions,
			}),
		[zoomRegions, panRegions, clipRegions, audioRegions],
	);

	const getResolvedDropRowId = useCallback(
		(id: string, proposedRowId: string) => resolveDropRowId(id, proposedRowId, timelineItems),
		[timelineItems],
	);

	const handleItemSpanChange = useCallback(
		(id: string, span: Span, rowId?: string) => {
			const itemKind = resolveItemKind(id);
			if (itemKind === "zoom") {
				onZoomSpanChange(id, span);
			} else if (itemKind === "pan") {
				onPanSpanChange?.(id, span);
			} else if (itemKind === "trim") {
				onTrimSpanChange?.(id, span);
			} else if (itemKind === "clip") {
				onClipSpanChange?.(id, span);
			} else if (itemKind === "annotation") {
				const nextTrackIndex = resolveTrackIndex("annotation", id, rowId);
				onAnnotationSpanChange?.(id, span, nextTrackIndex);
			} else if (itemKind === "speed") {
				onSpeedSpanChange?.(id, span);
			} else if (itemKind === "audio") {
				const nextTrackIndex = resolveTrackIndex("audio", id, rowId);
				onAudioSpanChange?.(id, span, nextTrackIndex);
			}
		},
		[
			resolveItemKind,
			resolveTrackIndex,
			onZoomSpanChange,
			onPanSpanChange,
			onTrimSpanChange,
			onClipSpanChange,
			onAnnotationSpanChange,
			onSpeedSpanChange,
			onAudioSpanChange,
		],
	);

	const handleItemDuplicate = useCallback(
		(id: string, span: Span, rowId?: string) => {
			const itemKind = resolveItemKind(id);
			if (itemKind === "zoom") {
				onZoomDuplicate?.(id, span);
			} else if (itemKind === "pan") {
				onPanDuplicate?.(id, span);
			} else if (itemKind === "clip") {
				onClipDuplicate?.(id, span);
			} else if (itemKind === "annotation") {
				const nextTrackIndex = resolveTrackIndex("annotation", id, rowId);
				onAnnotationDuplicate?.(id, span, nextTrackIndex);
			} else if (itemKind === "audio") {
				const nextTrackIndex = resolveTrackIndex("audio", id, rowId);
				onAudioDuplicate?.(id, span, nextTrackIndex);
			}
		},
		[
			resolveItemKind,
			resolveTrackIndex,
			onZoomDuplicate,
			onPanDuplicate,
			onClipDuplicate,
			onAnnotationDuplicate,
			onAudioDuplicate,
		],
	);

	return {
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
		handleItemDuplicate,
	};
}
