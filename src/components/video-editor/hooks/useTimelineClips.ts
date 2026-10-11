import type { Span } from "dnd-timeline";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ClipRegion,
	clipsToTrims,
	extendAutoFullTrackClip,
	mapSourceTimeToTimelineTime as resolveSourceTimeToTimelineTime,
	mapTimelineTimeToSourceTime as resolveTimelineTimeToSourceTime,
	type SpeedRegion,
	type TrimRegion,
} from "../types";

export interface UseTimelineClipsOptions {
	duration: number;
	speedRegions: SpeedRegion[];
	onClearSelectedOther?: () => void;
	onSelectSection?: (section: "clip" | "scene") => void;
	onRegionsTrimmed?: <T extends { startMs: number; endMs: number }>(
		updater: (prev: T[]) => T[],
	) => void;
	onZoomScaleForClip?: (clip: ClipRegion, scaleFactor: number) => void;
	onClipDeletedFromOtherTracks?: (startMs: number, endMs: number) => void;
}

export function useTimelineClips({
	duration,
	speedRegions,
	onClearSelectedOther,
	onSelectSection,
	onZoomScaleForClip,
	onClipDeletedFromOtherTracks,
}: UseTimelineClipsOptions) {
	const [clipRegions, setClipRegions] = useState<ClipRegion[]>([]);
	const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const nextClipIdRef = useRef(1);
	const autoFullTrackClipIdRef = useRef<string | null>(null);
	const autoFullTrackClipEndMsRef = useRef<number | null>(null);

	// Automatically extend single full-track clip when duration increases
	useEffect(() => {
		const totalMs = Math.round(duration * 1000);
		if (totalMs <= 0) return;

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

	const handleSelectClip = useCallback(
		(id: string | null) => {
			setSelectedClipId(id);
			if (id) {
				onSelectSection?.("clip");
				onClearSelectedOther?.();
			} else {
				onSelectSection?.("scene");
			}
		},
		[onSelectSection, onClearSelectedOther],
	);

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
		(
			id: string,
			span: Span,
			onTrimOtherTracks?: (
				removedSegments: Array<{ startMs: number; endMs: number }>,
			) => void,
			onShiftOtherTracks?: (delta: number, oldClip: ClipRegion) => void,
		) => {
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
					onShiftOtherTracks?.(startDelta, oldClip);
				}
			}

			if (removedSegments.length > 0) {
				onTrimOtherTracks?.(removedSegments);
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
			onZoomScaleForClip?.(clip, scaleFactor);
		},
		[selectedClipId, clipRegions, onZoomScaleForClip],
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
				onClipDeletedFromOtherTracks?.(deletedClip.startMs, deletedClip.endMs);
			}
			if (selectedClipId === id) {
				setSelectedClipId(null);
			}
		},
		[clipRegions, selectedClipId, onClipDeletedFromOtherTracks],
	);

	return {
		clipRegions,
		setClipRegions,
		trimRegions,
		setTrimRegions,
		selectedClipId,
		setSelectedClipId,
		nextClipIdRef,
		autoFullTrackClipEndMsRef,
		mapTimelineTimeToSourceTime,
		mapSourceTimeToTimelineTime,
		handleSelectClip,
		handleClipSplit,
		handleClipSpanChange,
		handleClipSpeedChange,
		handleClipMutedChange,
		handleClipShowSourceAudioChange,
		handleClipDelete,
	};
}
