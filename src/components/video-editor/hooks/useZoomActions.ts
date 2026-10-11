import type { Span } from "dnd-timeline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extensionHost } from "@/lib/extensions";
import { resolveZoomFocusForSpan } from "../timeline/zoomSuggestionUtils";
import {
	type CursorTelemetryPoint,
	clampFocusToDepth,
	DEFAULT_AUTO_ZOOM_DEPTH,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomMode,
	type ZoomRegion,
} from "../types";

export interface UseZoomActionsOptions {
	videoPath: string | null;
	duration: number;
	loading: boolean;
	isPreviewReady: boolean;
	cursorTelemetry: CursorTelemetryPoint[];
	normalizedCursorTelemetry: CursorTelemetryPoint[];
	mapTimelineTimeToSourceTime: (timelineMs: number) => number;
	onClearSelectedAnnotation?: () => void;
}

export function useZoomActions({
	videoPath,
	duration,
	loading,
	isPreviewReady,
	cursorTelemetry,
	normalizedCursorTelemetry,
	mapTimelineTimeToSourceTime,
	onClearSelectedAnnotation,
}: UseZoomActionsOptions) {
	const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [autoSuggestZoomsTrigger, setAutoSuggestZoomsTrigger] = useState(0);

	const nextZoomIdRef = useRef(1);
	const autoSuggestedVideoPathRef = useRef<string | null>(null);
	const pendingFreshRecordingAutoZoomPathRef = useRef<string | null>(null);
	const pendingFreshRecordingAutoSuggestTimeoutRef = useRef<number | null>(null);
	const pendingFreshRecordingAutoSuggestTelemetryCountRef = useRef(0);

	const resetAutoSuggestState = useCallback(() => {
		autoSuggestedVideoPathRef.current = null;
		pendingFreshRecordingAutoSuggestTelemetryCountRef.current = 0;
		if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
		}
	}, []);

	const handleZoomAdded = useCallback(
		(span: Span) => {
			const id = `zoom-${nextZoomIdRef.current++}`;
			const defaultDepth: ZoomDepth = 2;
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
			setZoomRegions((prev) => [...prev, newRegion]);
			setSelectedZoomId(id);
			onClearSelectedAnnotation?.();
			extensionHost.emitEvent({
				type: "timeline:region-added",
				data: { id, startMs: newRegion.startMs, endMs: newRegion.endMs },
			});
		},
		[
			videoPath,
			normalizedCursorTelemetry,
			mapTimelineTimeToSourceTime,
			onClearSelectedAnnotation,
		],
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

	const zoomsEnabled = useMemo(
		() => zoomRegions.length === 0 || zoomRegions.some((region) => !region.disabled),
		[zoomRegions],
	);

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

	return {
		zoomRegions,
		setZoomRegions,
		selectedZoomId,
		setSelectedZoomId,
		autoSuggestZoomsTrigger,
		setAutoSuggestZoomsTrigger,
		zoomsEnabled,
		nextZoomIdRef,
		autoSuggestedVideoPathRef,
		pendingFreshRecordingAutoZoomPathRef,
		pendingFreshRecordingAutoSuggestTimeoutRef,
		pendingFreshRecordingAutoSuggestTelemetryCountRef,
		resetAutoSuggestState,
		handleZoomAdded,
		handleZoomSuggested,
		handleToggleZooms,
		handleZoomSpanChange,
		handleZoomFocusChange,
		handleZoomDepthChange,
		handleZoomModeChange,
		handleZoomDelete,
	};
}
