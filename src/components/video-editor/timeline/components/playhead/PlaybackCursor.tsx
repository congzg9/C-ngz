import { useTimelineContext } from "dnd-timeline";
import { type RefObject, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatPlayheadTime } from "../../core/time";

interface PlaybackCursorProps {
	currentTimeMs: number;
	videoDurationMs: number;
	onSeek?: (time: number) => void;
	timelineRef: RefObject<HTMLDivElement>;
	keyframes?: { id: string; time: number }[];
	isLoading?: boolean;
}

export default function PlaybackCursor({
	currentTimeMs,
	videoDurationMs,
	onSeek,
	timelineRef,
	keyframes = [],
	isLoading = false,
}: PlaybackCursorProps) {
	const { sidebarWidth, direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!timelineRef.current || !onSeek) return;
			const rect = timelineRef.current.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;
			const relativeMs = pixelsToValue(clickX);
			let absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));

			const snapThresholdMs = 150;
			const nearbyKeyframe = keyframes.find(
				(kf) =>
					Math.abs(kf.time - absoluteMs) <= snapThresholdMs &&
					kf.time >= range.start &&
					kf.time <= range.end,
			);
			if (nearbyKeyframe) absoluteMs = nearbyKeyframe.time;

			onSeek(absoluteMs / 1000);
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			document.body.style.cursor = "";
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "ew-resize";

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
		};
	}, [
		isDragging,
		onSeek,
		timelineRef,
		sidebarWidth,
		range.start,
		range.end,
		videoDurationMs,
		pixelsToValue,
		keyframes,
	]);

	if (videoDurationMs <= 0 || currentTimeMs < 0) return null;
	const clampedTime = Math.min(currentTimeMs, videoDurationMs);
	if (clampedTime < range.start || clampedTime > range.end) return null;

	const offset = valueToPixels(clampedTime - range.start);

	return (
		<div
			className="absolute inset-0 pointer-events-none z-50 overflow-hidden"
			style={{
				[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
			}}
		>
			<div
				className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
				style={{
					left: 0,
					transform:
						direction === "rtl"
							? `translate3d(-${offset}px, 0, 0) translateX(50%)`
							: `translate3d(${offset}px, 0, 0) translateX(-50%)`,
					willChange: "transform",
				}}
			>
				{/* Professional Playhead Badge at top (aligned on ruler) */}
				<div
					className="relative flex flex-col items-center flex-shrink-0 -mt-0.5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] pointer-events-auto cursor-ew-resize transition-transform hover:scale-110 active:scale-95"
					title={formatPlayheadTime(clampedTime)}
					onMouseDown={(e) => {
						e.stopPropagation();
						setIsDragging(true);
					}}
				>
					<svg
						width="14"
						height="18"
						viewBox="0 0 14 18"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M 1 2 C 1 0.895 1.895 0 3 0 L 11 0 C 12.105 0 13 0.895 13 2 L 13 11.5 L 7 17.5 L 1 11.5 Z"
							fill="#2563EB"
							stroke="rgba(255,255,255,0.45)"
							strokeWidth="1"
						/>
						<line
							x1="4.5"
							y1="5"
							x2="9.5"
							y2="5"
							stroke="rgba(255,255,255,0.85)"
							strokeWidth="1"
							strokeLinecap="round"
						/>
						<line
							x1="4.5"
							y1="8"
							x2="9.5"
							y2="8"
							stroke="rgba(255,255,255,0.85)"
							strokeWidth="1"
							strokeLinecap="round"
						/>
					</svg>
				</div>

				{/* Single continuous vertical needle running from tip of badge through all tracks */}
				<div
					className="w-[1.5px] flex-1 bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.6)] cursor-ew-resize pointer-events-auto hover:bg-[#3B82F6] hover:shadow-[0_0_12px_rgba(37,99,235,0.85)] relative"
					onMouseDown={(e) => {
						e.stopPropagation();
						setIsDragging(true);
					}}
				>
					{/* Hit area for easy grabbing on tracks */}
					<div className="absolute inset-y-0 -left-2 -right-2 cursor-ew-resize" />
				</div>

				{/* Dragging / loading tooltip */}
				<div
					className={cn(
						"absolute top-8 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/85 text-[10px] text-white/95 font-medium tabular-nums whitespace-nowrap border border-white/10 shadow-lg pointer-events-none transition-opacity z-50",
						isDragging || isLoading ? "opacity-100" : "opacity-0",
					)}
				>
					<div className="flex items-center">
						{formatPlayheadTime(clampedTime)
							.split("")
							.map((char, i) => (
								<span
									key={i}
									className={cn(
										"leading-5 whitespace-pre",
										isLoading &&
											"bg-gradient-to-r from-white/40 via-white to-white/40 bg-clip-text text-transparent animate-text-shimmer",
									)}
									style={
										isLoading
											? {
													animationDelay: `${i * 0.05}s`,
													animationDuration: "2.5s",
												}
											: undefined
									}
								>
									{char}
								</span>
							))}
					</div>
				</div>
			</div>
		</div>
	);
}
