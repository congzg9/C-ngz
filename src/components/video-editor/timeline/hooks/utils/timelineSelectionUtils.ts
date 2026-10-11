export type DeleteSelectionTarget =
	| "all"
	| "keyframe"
	| "zoom"
	| "pan"
	| "clip"
	| "annotation"
	| "audio"
	| "none";

interface ResolveDeleteSelectionTargetParams {
	selectAllBlocksActive: boolean;
	selectedKeyframeId: string | null;
	selectedZoomId: string | null;
	selectedPanId?: string | null;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
}

export function resolveDeleteSelectionTarget({
	selectAllBlocksActive,
	selectedKeyframeId,
	selectedZoomId,
	selectedPanId,
	selectedClipId,
	selectedAnnotationId,
	selectedAudioId,
}: ResolveDeleteSelectionTargetParams): DeleteSelectionTarget {
	if (selectAllBlocksActive) return "all";
	if (selectedKeyframeId) return "keyframe";
	if (selectedZoomId) return "zoom";
	if (selectedPanId) return "pan";
	if (selectedClipId) return "clip";
	if (selectedAnnotationId) return "annotation";
	if (selectedAudioId) return "audio";
	return "none";
}
