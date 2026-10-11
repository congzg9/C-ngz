import {
	ArrowsOutCardinal,
	FilmSlate as Film,
	Gauge,
	ChatCircle as MessageSquare,
	MusicNotes as Music,
	MouseLeftClickIcon as PhMouseLeftClick,
	Scissors,
	SpeakerX,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import { useItem } from "dnd-timeline";
import { useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import AudioVolumeEnvelope from "./components/waveform/AudioVolumeEnvelope";
import AudioWaveform from "./components/waveform/AudioWaveform";
import type { AudioPeaksData } from "./core/timelineTypes";
import glassStyles from "./ItemGlass.module.css";

interface ItemProps {
	id: string;
	span: Span;
	rowId: string;
	disabled?: boolean;
	children: React.ReactNode;
	isSelected?: boolean;
	onSelect?: () => void;
	onSelectId?: (id: string) => void;
	zoomDepth?: number;
	zoomMode?: "auto" | "manual";
	speedValue?: number;
	waveformPeaks?: AudioPeaksData | null;
	waveformSegmentSpan?: Span;
	waveformGain?: number;
	waveformNormalize?: boolean;
	audioVolume?: number;
	audioFadeInMs?: number;
	audioFadeOutMs?: number;
	muted?: boolean;
	variant?: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "pan";
	isLoading?: boolean;
	loadingLabel?: string;
	onSeekToClientX?: (clientX: number) => void;
	isRazorMode?: boolean;
	onRazorCut?: (clientX: number) => void;
	onHoverClientX?: (clientX: number) => void;
}

// Map zoom depth to multiplier labels
const ZOOM_LABELS: Record<number, string> = {
	1: "1.25×",
	2: "1.5×",
	3: "1.8×",
	4: "2.2×",
	5: "3.5×",
	6: "5×",
};

function formatMs(ms: number): string {
	const totalSeconds = ms / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
	}
	return `${seconds.toFixed(1)}s`;
}

export default function Item({
	id,
	span,
	rowId,
	disabled = false,
	isSelected = false,
	onSelect,
	onSelectId,
	zoomDepth = 1,
	zoomMode = "auto",
	speedValue,
	waveformPeaks = null,
	waveformSegmentSpan,
	waveformGain = 1,
	waveformNormalize = false,
	audioVolume,
	audioFadeInMs,
	audioFadeOutMs,
	muted = false,
	variant = "zoom",
	isLoading = false,
	loadingLabel,
	onSeekToClientX,
	isRazorMode = false,
	onRazorCut,
	onHoverClientX,
	children,
}: ItemProps) {
	const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
		id,
		span,
		disabled: disabled || isLoading,
		data: { rowId },
	});

	const timeLabel = useMemo(
		() => `${formatMs(span.start)} – ${formatMs(span.end)}`,
		[span.start, span.end],
	);

	const pointerDownPosRef = useRef<{ clientX: number; clientY: number; time: number } | null>(
		null,
	);

	if (isLoading) {
		return (
			<div
				ref={setNodeRef}
				style={{
					...itemStyle,
					height: "100%",
					display: "flex",
					alignItems: "center",
				}}
				{...listeners}
				{...attributes}
				data-timeline-item="true"
				onMouseDownCapture={(event) => event.stopPropagation()}
				onClickCapture={(event) => event.stopPropagation()}
			>
				<Skeleton
					variant="clip"
					animation="shimmer-premium"
					label={loadingLabel || "Loading..."}
					className="w-full"
					style={{ height: "85%", minHeight: 22 }}
				/>
			</div>
		);
	}

	const isPan = variant === "pan";
	const isZoom = variant === "zoom";
	const isTrim = variant === "trim";
	const isClip = variant === "clip";
	const isSpeed = variant === "speed";
	const isAudio = variant === "audio";
	const isAnnotation = variant === "annotation";
	const showAudioWaveform = isAudio && Boolean(waveformPeaks);

	const glassClass = isPan
		? glassStyles.glassEmerald
		: isZoom || isAnnotation
			? glassStyles.glassPurple
			: isTrim
				? glassStyles.glassRed
				: isClip
					? glassStyles.glassCyan
					: isSpeed
						? glassStyles.glassAmber
						: isAudio
							? glassStyles.glassDarkGreen
							: glassStyles.glassPurple;

	const MIN_ITEM_PX = 6;

	const handleSelect = () => {
		onSelect?.();
		onSelectId?.(id);
	};

	const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		if (isRazorMode) {
			event.stopPropagation();
			return;
		}
		const target = event.target as HTMLElement | null;
		if (target?.closest?.("[data-resize-handle]")) {
			pointerDownPosRef.current = null;
			handleSelect();
			return;
		}

		const startX = event.clientX;
		const startY = event.clientY;
		const startTime = Date.now();

		pointerDownPosRef.current = {
			clientX: startX,
			clientY: startY,
			time: startTime,
		};
		handleSelect();

		if (onSeekToClientX) {
			onSeekToClientX(event.clientX);
		}
	};

	const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
		const target = event.target as HTMLElement | null;
		if (target?.closest?.("[data-resize-handle]")) return;
		if (isRazorMode && onRazorCut) {
			onRazorCut(event.clientX);
			return;
		}
		if (onSeekToClientX) {
			onSeekToClientX(event.clientX);
		}
	};

	const safeItemStyle = {
		...itemStyle,
		minWidth: MIN_ITEM_PX,
		height: "100%",
		overflow: "hidden",
	};

	return (
		<div
			ref={setNodeRef}
			style={safeItemStyle}
			{...listeners}
			{...attributes}
			data-timeline-item="true"
			data-variant={variant}
			onPointerDownCapture={handlePointerDownCapture}
			onClick={handleClick}
			onMouseMove={(e) => onHoverClientX?.(e.clientX)}
			className="group h-full cursor-default"
		>
			<div
				className="h-full"
				style={{
					...itemContentStyle,
					minWidth: MIN_ITEM_PX,
					height: "100%",
					display: "flex",
					alignItems: "center",
				}}
			>
				<div
					className={cn(
						glassClass,
						"w-full overflow-hidden flex items-center justify-center gap-1.5 relative cursor-default",
						isSelected && glassStyles.selected,
						(isZoom || isPan) && muted && "opacity-55 grayscale-[50%]",
					)}
					style={{
						height: "85%",
						minHeight: 22,
						minWidth: MIN_ITEM_PX,
					}}
					onClick={handleClick}
				>
					{!isClip && (
						<>
							<div
								data-resize-handle="true"
								className={cn(glassStyles.zoomEndCap, glassStyles.left)}
								style={{ cursor: "col-resize", pointerEvents: "auto" }}
								title="Resize left"
							/>
							<div
								data-resize-handle="true"
								className={cn(glassStyles.zoomEndCap, glassStyles.right)}
								style={{ cursor: "col-resize", pointerEvents: "auto" }}
								title="Resize right"
							/>
						</>
					)}
					{showAudioWaveform && waveformPeaks && (
						<AudioWaveform
							peaks={waveformPeaks}
							segmentStartMs={waveformSegmentSpan?.start ?? span.start}
							segmentEndMs={waveformSegmentSpan?.end ?? span.end}
							gain={waveformGain}
							normalize={waveformNormalize}
							className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
						/>
					)}
					{isAudio && (
						<AudioVolumeEnvelope
							volume={audioVolume ?? waveformGain ?? 1}
							fadeInMs={audioFadeInMs}
							fadeOutMs={audioFadeOutMs}
							durationMs={Math.max(1, span.end - span.start)}
							isSelected={isSelected}
							muted={muted}
						/>
					)}
					{/* Muted overlay for source audio track items */}
					{isAudio && muted && (
						<div className="absolute inset-0 z-20 flex items-center justify-center gap-1 bg-red-900/40 pointer-events-none">
							<SpeakerX className="w-3 h-3 text-red-300/90 shrink-0" />
						</div>
					)}
					{/* Content */}
					<div className="relative z-10 flex flex-col items-center justify-center text-black/70 dark:text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none overflow-hidden">
						<div className="flex items-center gap-1.5">
							{isPan ? (
								<>
									<ArrowsOutCardinal
										className="w-3.5 h-3.5 shrink-0"
										weight="bold"
									/>
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{speedValue ? `Pan · ${speedValue}x` : "Pan"}
									</span>
								</>
							) : isZoom ? (
								<>
									<ZoomIn className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{ZOOM_LABELS[zoomDepth] || `${zoomDepth}×`}
									</span>
								</>
							) : isTrim ? (
								<>
									<Scissors className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										Trim
									</span>
								</>
							) : isClip ? (
								<>
									<Film className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										Clip
									</span>
								</>
							) : isSpeed ? (
								<>
									<Gauge className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{speedValue !== undefined ? `${speedValue}×` : "Tốc độ"}
									</span>
								</>
							) : isAudio ? (
								<>
									<Music className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight truncate max-w-full">
										{children}
									</span>
								</>
							) : (
								<>
									<MessageSquare className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{children}
									</span>
								</>
							)}
						</div>
						{isZoom ? (
							<div
								className={`flex items-center gap-0.5 transition-opacity ${isSelected ? "opacity-70" : "opacity-0 group-hover:opacity-50"}`}
							>
								<PhMouseLeftClick
									className="w-2.5 h-2.5 shrink-0"
									weight={zoomMode === "manual" ? "regular" : "fill"}
								/>
								<span className="text-[9px] font-medium tracking-tight whitespace-nowrap">
									{zoomMode === "manual" ? "Manual" : "Auto"}
								</span>
							</div>
						) : (
							<span
								className={`text-[9px] tabular-nums tracking-tight whitespace-nowrap transition-opacity ${
									isSelected ? "opacity-60" : "opacity-0 group-hover:opacity-40"
								}`}
							>
								{timeLabel}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
