import type { Span } from "dnd-timeline";
import { useCallback, useMemo } from "react";
import type { PanRegion } from "../../../types";

interface UseTimelinePanActionsParams {
	timeline: {
		videoDuration: number;
		totalMs: number;
		currentTimeMs: number;
	};
	regions: {
		pan: PanRegion[];
		clip: { startMs: number; endMs: number }[];
	};
	onPanAdded?: (span: Span) => void;
}

export function useTimelinePanActions({
	timeline,
	regions,
	onPanAdded,
}: UseTimelinePanActionsParams) {
	const { videoDuration, totalMs, currentTimeMs } = timeline;
	const { pan: panRegions } = regions;
	const defaultRegionDurationMs = useMemo(() => Math.min(1000, totalMs), [totalMs]);

	const canPlacePanAtMs = useCallback(
		(startMs: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				return false;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return false;
			}

			const normalizedStart = Math.max(0, Math.min(startMs, totalMs));
			const targetEnd = Math.min(normalizedStart + defaultDuration, totalMs);

			if (targetEnd - normalizedStart < 50) {
				return false;
			}

			// Don't place on top of an existing pan block
			const hasOverlap = panRegions.some(
				(p) => normalizedStart < p.endMs && targetEnd > p.startMs,
			);
			return !hasOverlap;
		},
		[videoDuration, totalMs, defaultRegionDurationMs, panRegions],
	);

	const addPanAtMs = useCallback(
		(startMs: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onPanAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const normalizedStart = Math.max(0, Math.min(startMs, totalMs));
			let targetEnd = Math.min(normalizedStart + defaultDuration, totalMs);

			// If overlapping next pan, clamp to its start
			const nextPan = panRegions
				.filter((p) => p.startMs > normalizedStart)
				.sort((a, b) => a.startMs - b.startMs)[0];
			if (nextPan && nextPan.startMs < targetEnd) {
				targetEnd = nextPan.startMs;
			}

			if (targetEnd - normalizedStart < 50) {
				return;
			}

			onPanAdded({ start: normalizedStart, end: targetEnd });
		},
		[videoDuration, totalMs, defaultRegionDurationMs, panRegions, onPanAdded],
	);

	const handleAddPan = useCallback(() => {
		addPanAtMs(currentTimeMs);
	}, [addPanAtMs, currentTimeMs]);

	return {
		canPlacePanAtMs,
		addPanAtMs,
		handleAddPan,
	};
}
