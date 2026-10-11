import type { AnnotationRegion, AudioRegion, ClipRegion, PanRegion, ZoomRegion } from "../../types";
import { CLIP_ROW_ID, PAN_ROW_ID, ZOOM_ROW_ID } from "../core/constants";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../core/rows";
import type { TimelineRegionSpan, TimelineRenderItem } from "../core/timelineTypes";

export function getAnnotationLabel(region: AnnotationRegion): string {
	if (region.type === "text") {
		const preview = region.content.trim() || "Empty text";
		return preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
	}
	if (region.type === "image") {
		return "Image";
	}
	return "Annotation";
}

export function getAudioLabel(region: AudioRegion): string {
	return (
		region.audioPath
			.split(/[\\/]/)
			.pop()
			?.replace(/\.[^.]+$/, "") || "Audio"
	);
}

export function buildTimelineItems(params: {
	zoomRegions: ZoomRegion[];
	panRegions?: PanRegion[];
	clipRegions: ClipRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
}): TimelineRenderItem[] {
	const { zoomRegions, panRegions = [], clipRegions, annotationRegions, audioRegions } = params;
	const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
		id: region.id,
		rowId: ZOOM_ROW_ID,
		span: { start: region.startMs, end: region.endMs },
		label: `Zoom ${index + 1}`,
		zoomDepth: region.depth,
		zoomMode: region.mode ?? "auto",
		pan: region.pan,
		muted: region.disabled === true,
		variant: "zoom",
	}));

	const pans: TimelineRenderItem[] = panRegions.map((region, index) => ({
		id: region.id,
		rowId: PAN_ROW_ID,
		span: { start: region.startMs, end: region.endMs },
		label: `Pan ${index + 1}`,
		muted: region.disabled === true,
		variant: "pan",
		speedValue: region.speed ?? 2,
	}));

	const clips: TimelineRenderItem[] = clipRegions.map((region, index) => {
		const displayDurationMs = Math.max(0, region.endMs - region.startMs);
		const speed = Number.isFinite(region.speed) && region.speed > 0 ? region.speed : 1;
		const sourceEndMs = region.startMs + displayDurationMs * speed;

		return {
			id: region.id,
			rowId: CLIP_ROW_ID,
			span: { start: region.startMs, end: region.endMs },
			sourceSpan: { start: region.startMs, end: sourceEndMs },
			label: `Clip ${index + 1}`,
			showSourceAudio: region.showSourceAudio,
			muted: Boolean(region.muted),
			variant: "clip",
		};
	});

	const annotations: TimelineRenderItem[] = annotationRegions.map((region) => ({
		id: region.id,
		rowId: getAnnotationTrackRowId(region.trackIndex ?? 0),
		span: { start: region.startMs, end: region.endMs },
		label: getAnnotationLabel(region),
		variant: "annotation",
	}));

	const audios: TimelineRenderItem[] = audioRegions.map((region) => ({
		id: region.id,
		rowId: getAudioTrackRowId(region.trackIndex ?? 0),
		span: { start: region.startMs, end: region.endMs },
		label: getAudioLabel(region),
		audioPath: region.audioPath,
		audioGain: region.volume,
		audioNormalize: Boolean(region.normalize),
		audioFadeInMs: region.fadeInMs,
		audioFadeOutMs: region.fadeOutMs,
		variant: "audio",
	}));

	return [...zooms, ...pans, ...clips, ...annotations, ...audios];
}

export function buildAllRegionSpans(params: {
	zoomRegions: ZoomRegion[];
	panRegions?: PanRegion[];
	clipRegions: ClipRegion[];
	audioRegions: AudioRegion[];
}): TimelineRegionSpan[] {
	const { zoomRegions, panRegions = [], clipRegions, audioRegions } = params;
	const zooms = zoomRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: ZOOM_ROW_ID,
	}));
	const pans = panRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: PAN_ROW_ID,
	}));
	const clips = clipRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: CLIP_ROW_ID,
	}));
	const audios = audioRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: getAudioTrackRowId(r.trackIndex ?? 0),
	}));
	return [...zooms, ...pans, ...clips, ...audios];
}

export function resolveDropRowId(
	id: string,
	proposedRowId: string,
	timelineItems: TimelineRenderItem[],
) {
	const currentRowId = timelineItems.find((item) => item.id === id)?.rowId;
	if (!currentRowId) {
		return proposedRowId;
	}

	if (isAnnotationTrackRowId(currentRowId)) {
		return isAnnotationTrackRowId(proposedRowId)
			? getAnnotationTrackRowId(getAnnotationTrackIndex(proposedRowId))
			: currentRowId;
	}

	if (isAudioTrackRowId(currentRowId)) {
		return isAudioTrackRowId(proposedRowId)
			? getAudioTrackRowId(getAudioTrackIndex(proposedRowId))
			: currentRowId;
	}

	return currentRowId;
}
