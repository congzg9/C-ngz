import { useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { TimelineRegion } from "../core/timelineTypes";

interface UseTimelineSelectionParams {
	totalMs: number;
	currentTimeMs: number;
	zoomRegions: TimelineRegion[];
	panRegions?: TimelineRegion[];
	clipRegions: TimelineRegion[];
	annotationRegions: (TimelineRegion & { zIndex: number })[];
	audioRegions: TimelineRegion[];
	selectedZoomId: string | null;
	selectedPanId?: string | null;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	onZoomDelete: (id: string) => void;
	onPanDelete?: (id: string) => void;
	onClipDelete?: (id: string) => void;
	onAnnotationDelete?: (id: string) => void;
	onAudioDelete?: (id: string) => void;
	onSelectZoom: (id: string | null) => void;
	onSelectPan?: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
}

export function useTimelineSelection({
	totalMs,
	currentTimeMs,
	zoomRegions,
	panRegions = [],
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
}: UseTimelineSelectionParams) {
	const [keyframes, setKeyframes] = useState<{ id: string; time: number }[]>([]);
	const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
	const [selectAllBlocksActive, setSelectAllBlocksActive] = useState(false);

	const addKeyframe = useCallback(() => {
		if (totalMs === 0) return;
		const time = Math.max(0, Math.min(currentTimeMs, totalMs));
		if (keyframes.some((kf) => Math.abs(kf.time - time) < 1)) return;
		setKeyframes((prev) => [...prev, { id: uuidv4(), time }]);
	}, [currentTimeMs, totalMs, keyframes]);

	const deleteSelectedKeyframe = useCallback(() => {
		if (!selectedKeyframeId) return;
		setKeyframes((prev) => prev.filter((kf) => kf.id !== selectedKeyframeId));
		setSelectedKeyframeId(null);
	}, [selectedKeyframeId]);

	const handleKeyframeMove = useCallback(
		(id: string, newTime: number) => {
			setKeyframes((prev) =>
				prev.map((kf) =>
					kf.id === id ? { ...kf, time: Math.max(0, Math.min(newTime, totalMs)) } : kf,
				),
			);
		},
		[totalMs],
	);

	const deleteSelectedZoom = useCallback(() => {
		if (!selectedZoomId) return;
		onZoomDelete(selectedZoomId);
		onSelectZoom(null);
	}, [selectedZoomId, onZoomDelete, onSelectZoom]);

	const deleteSelectedPan = useCallback(() => {
		if (!selectedPanId || !onPanDelete) return;
		onPanDelete(selectedPanId);
		onSelectPan?.(null);
	}, [selectedPanId, onPanDelete, onSelectPan]);

	const deleteSelectedClip = useCallback(() => {
		if (!selectedClipId || !onClipDelete || !onSelectClip) return;
		onClipDelete(selectedClipId);
		onSelectClip(null);
	}, [selectedClipId, onClipDelete, onSelectClip]);

	const deleteSelectedAnnotation = useCallback(() => {
		if (!selectedAnnotationId || !onAnnotationDelete || !onSelectAnnotation) return;
		onAnnotationDelete(selectedAnnotationId);
		onSelectAnnotation(null);
	}, [selectedAnnotationId, onAnnotationDelete, onSelectAnnotation]);

	const deleteSelectedAudio = useCallback(() => {
		if (!selectedAudioId || !onAudioDelete || !onSelectAudio) return;
		onAudioDelete(selectedAudioId);
		onSelectAudio(null);
	}, [selectedAudioId, onAudioDelete, onSelectAudio]);

	const clearSelectedBlocks = useCallback(() => {
		onSelectZoom(null);
		onSelectPan?.(null);
		onSelectClip?.(null);
		onSelectAnnotation?.(null);
		onSelectAudio?.(null);
		setSelectAllBlocksActive(false);
	}, [onSelectZoom, onSelectPan, onSelectClip, onSelectAnnotation, onSelectAudio]);

	const hasAnyTimelineBlocks = useMemo(
		() =>
			zoomRegions.length > 0 ||
			panRegions.length > 0 ||
			clipRegions.length > 0 ||
			annotationRegions.length > 0 ||
			audioRegions.length > 0,
		[
			zoomRegions.length,
			panRegions.length,
			clipRegions.length,
			annotationRegions.length,
			audioRegions.length,
		],
	);

	const deleteAllBlocks = useCallback(() => {
		zoomRegions.map((r) => r.id).forEach((id) => onZoomDelete(id));
		panRegions.map((r) => r.id).forEach((id) => onPanDelete?.(id));
		clipRegions.map((r) => r.id).forEach((id) => onClipDelete?.(id));
		annotationRegions.map((r) => r.id).forEach((id) => onAnnotationDelete?.(id));
		audioRegions.map((r) => r.id).forEach((id) => onAudioDelete?.(id));
		clearSelectedBlocks();
		setSelectedKeyframeId(null);
	}, [
		zoomRegions,
		panRegions,
		clipRegions,
		annotationRegions,
		audioRegions,
		onZoomDelete,
		onPanDelete,
		onClipDelete,
		onAnnotationDelete,
		onAudioDelete,
		clearSelectedBlocks,
	]);

	const handleSelectZoom = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectZoom(id);
			if (id) {
				onSelectPan?.(null);
			}
		},
		[onSelectZoom, onSelectPan],
	);

	const handleSelectPan = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectPan?.(id);
			if (id) {
				onSelectZoom(null);
			}
		},
		[onSelectPan, onSelectZoom],
	);

	const handleSelectClip = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectClip?.(id);
		},
		[onSelectClip],
	);

	const handleSelectAnnotation = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectAnnotation?.(id);
		},
		[onSelectAnnotation],
	);

	const handleSelectAudio = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectAudio?.(id);
		},
		[onSelectAudio],
	);

	const cycleAnnotationsAtCurrentTime = useCallback(
		(backward = false) => {
			const overlapping = annotationRegions
				.filter((a) => currentTimeMs >= a.startMs && currentTimeMs <= a.endMs)
				.sort((a, b) => a.zIndex - b.zIndex);
			if (overlapping.length === 0) {
				return false;
			}

			if (!selectedAnnotationId || !overlapping.some((a) => a.id === selectedAnnotationId)) {
				onSelectAnnotation?.(overlapping[0].id);
				return true;
			}

			const currentIndex = overlapping.findIndex((a) => a.id === selectedAnnotationId);
			const nextIndex = backward
				? (currentIndex - 1 + overlapping.length) % overlapping.length
				: (currentIndex + 1) % overlapping.length;
			onSelectAnnotation?.(overlapping[nextIndex].id);
			return true;
		},
		[annotationRegions, currentTimeMs, selectedAnnotationId, onSelectAnnotation],
	);

	return {
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
	};
}
