import type { Span } from "dnd-timeline";
import type { ShortcutBinding } from "@/lib/shortcuts";
import type { ZoomMode } from "../../types";

export interface TimelineRegionSpan {
	id: string;
	start: number;
	end: number;
	rowId: string;
}

export interface TimelineRegion {
	id: string;
	startMs: number;
	endMs: number;
}

export interface TimelineAudioRegion extends TimelineRegion {
	trackIndex?: number;
}

export interface TimelineShortcutBindings {
	addKeyframe: ShortcutBinding;
	addZoom: ShortcutBinding;
	splitClip: ShortcutBinding;
	addAnnotation: ShortcutBinding;
	deleteSelected: ShortcutBinding;
}

export interface TimelineRenderItem {
	id: string;
	rowId: string;
	span: Span;
	sourceSpan?: Span;
	label: string;
	audioPath?: string;
	audioGain?: number;
	audioNormalize?: boolean;
	audioFadeInMs?: number;
	audioFadeOutMs?: number;
	zoomDepth?: number;
	zoomMode?: ZoomMode;
	pan?: boolean;
	speedValue?: number;
	showSourceAudio?: boolean;
	muted?: boolean;
	variant: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "pan";
}

export interface AudioPeaksData {
	durationMs: number;
	peaks: Float32Array;
}
