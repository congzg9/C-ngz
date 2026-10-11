import { useTimelineContext } from "dnd-timeline";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { calculateAxisScale, formatPlayheadTime, formatTimeLabel } from "../../core/time";

interface TimelineAxisProps {
	videoDurationMs: number;
	currentTimeMs: number;
	onSeek?: (seconds: number) => void;
}

interface MajorMarker {
	time: number;
	label: string;
}

interface Tick {
	time: number;
	type: "medium" | "minor";
}

export default function TimelineAxis({
	videoDurationMs,
	currentTimeMs,
	onSeek,
}: TimelineAxisProps) {
	const { sidebarWidth, direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";

	const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null);
	const [hoverX, setHoverX] = useState<number>(0);

	const { intervalMs } = useMemo(
		() => calculateAxisScale(range.end - range.start),
		[range.end, range.start],
	);

	const { majorMarkers, subTicks } = useMemo(() => {
		if (intervalMs <= 0) {
			return { majorMarkers: [], subTicks: [] };
		}

		const maxTime = videoDurationMs > 0 ? videoDurationMs : range.end;
		const visibleStart = Math.max(0, Math.min(range.start, maxTime));
		const visibleEnd = Math.min(range.end, maxTime);

		// Determine subdivision count based on pixel width of one interval
		const pxPerInterval = Math.abs(
			valueToPixels(visibleStart + intervalMs) - valueToPixels(visibleStart),
		);
		let subdivisions = 10;
		if (pxPerInterval < 50) {
			subdivisions = 2;
		} else if (pxPerInterval < 100) {
			subdivisions = 5;
		}

		const subInterval = intervalMs / subdivisions;

		// Major markers
		const markerTimes = new Set<number>();
		const firstMajor = Math.floor(visibleStart / intervalMs) * intervalMs;
		for (let time = firstMajor; time <= visibleEnd + intervalMs; time += intervalMs) {
			if (time >= 0 && time <= maxTime + intervalMs * 0.1) {
				markerTimes.add(Math.round(time));
			}
		}

		if (visibleStart <= maxTime) markerTimes.add(Math.round(visibleStart));
		if (videoDurationMs > 0) markerTimes.add(Math.round(videoDurationMs));

		const sortedMajorTimes = Array.from(markerTimes)
			.filter((t) => t <= maxTime)
			.sort((a, b) => a - b);

		const majorMarkers: MajorMarker[] = sortedMajorTimes.map((time) => ({
			time,
			label: formatTimeLabel(time, intervalMs),
		}));

		// Sub-ticks (medium & minor frame ticks)
		const subTicks: Tick[] = [];
		const firstSub = Math.floor(visibleStart / subInterval) * subInterval;
		const halfStep = Math.floor(subdivisions / 2);

		for (let time = firstSub; time <= visibleEnd; time += subInterval) {
			if (time < 0 || time > maxTime) continue;
			const distToMajor = Math.min(
				Math.abs(time % intervalMs),
				Math.abs((time % intervalMs) - intervalMs),
			);
			if (distToMajor < 0.5) continue;

			const stepIndex = Math.round((time % intervalMs) / subInterval);
			const isMedium = stepIndex === halfStep;

			subTicks.push({
				time,
				type: isMedium ? "medium" : "minor",
			});
		}

		return { majorMarkers, subTicks };
	}, [intervalMs, range.end, range.start, valueToPixels, videoDurationMs]);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (e.button !== 0 || !onSeek) return;
			e.stopPropagation();

			const rect = e.currentTarget.getBoundingClientRect();
			const contentWidth = Math.max(1, rect.width - sidebarWidth);
			const seekFromEvent = (clientX: number) => {
				const rawOffsetX =
					direction === "rtl"
						? rect.right - clientX - sidebarWidth
						: clientX - rect.left - sidebarWidth;
				const offsetX = Math.max(0, Math.min(rawOffsetX, contentWidth));
				const relativeMs = pixelsToValue(offsetX);
				const targetMs = Math.max(
					0,
					Math.min(
						range.start + relativeMs,
						videoDurationMs > 0 ? videoDurationMs : range.end,
					),
				);
				onSeek(targetMs / 1000);
			};

			seekFromEvent(e.clientX);

			const onMouseMove = (moveEvt: MouseEvent) => {
				seekFromEvent(moveEvt.clientX);
			};

			const onMouseUp = () => {
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
				document.body.style.cursor = "";
			};

			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
			document.body.style.cursor = "ew-resize";
		},
		[direction, onSeek, pixelsToValue, range.end, range.start, sidebarWidth, videoDurationMs],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const rect = e.currentTarget.getBoundingClientRect();
			const contentWidth = Math.max(1, rect.width - sidebarWidth);
			const rawOffsetX =
				direction === "rtl"
					? rect.right - e.clientX - sidebarWidth
					: e.clientX - rect.left - sidebarWidth;
			const offsetX = Math.max(0, Math.min(rawOffsetX, contentWidth));
			const relativeMs = pixelsToValue(offsetX);
			const targetMs = Math.max(
				0,
				Math.min(
					range.start + relativeMs,
					videoDurationMs > 0 ? videoDurationMs : range.end,
				),
			);
			setHoverTimeMs(targetMs);
			setHoverX(offsetX);
		},
		[direction, pixelsToValue, range.end, range.start, sidebarWidth, videoDurationMs],
	);

	const handleMouseLeave = useCallback(() => {
		setHoverTimeMs(null);
	}, []);


	return (
		<div
			className="relative w-full flex-shrink-0 min-h-[28px] h-7 z-30 bg-editor-surface dark:bg-editor-surface border-b border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden select-none cursor-pointer group"
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			<div
				className="relative w-full h-full"
				style={{
					[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
				}}
			>
				{/* Frame and Sub-second ticks */}
				{subTicks.map((tick) => {
					const offset = valueToPixels(tick.time - range.start);
					return (
						<div
							key={`tick-${tick.time}`}
							className={cn(
								"absolute bottom-0 -translate-x-1/2 pointer-events-none transition-opacity",
								tick.type === "medium"
									? "h-2.5 w-[1px] bg-foreground/35 dark:bg-foreground/40"
									: "h-1.5 w-[1px] bg-foreground/20 dark:bg-foreground/25",
							)}
							style={{ [sideProperty]: `${offset}px` }}
						/>
					);
				})}

				{/* Major second ticks & Time labels */}
				{majorMarkers.map((marker) => {
					const offset = valueToPixels(marker.time - range.start);
					const isCurrent =
						Math.abs(marker.time - currentTimeMs) < Math.max(150, intervalMs * 0.15);

					return (
						<div
							key={`major-${marker.time}`}
							className="absolute top-0 bottom-0 pointer-events-none"
							style={{
								[sideProperty]: `${offset}px`,
								transform: direction === "rtl" ? "translateX(50%)" : "translateX(-50%)",
							}}
						>
							{/* Timestamp label */}
							<span
								className={cn(
									"absolute top-0.5 left-1/2 -translate-x-1/2 text-[10px] font-medium tabular-nums tracking-tight whitespace-nowrap",
									isCurrent
										? "text-[#2563EB] font-bold"
										: "text-foreground/75 dark:text-foreground/70",
								)}
							>
								{marker.label}
							</span>

							{/* Major vertical line */}
							<div
								className={cn(
									"absolute bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-3.5",
									isCurrent
										? "bg-[#2563EB]"
										: "bg-foreground/55 dark:bg-foreground/60",
								)}
							/>
						</div>
					);
				})}


				{/* Hover indicator */}
				{hoverTimeMs !== null && (
					<div
						className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
						style={{
							[sideProperty]: `${hoverX}px`,
							transform: direction === "rtl" ? "translateX(50%)" : "translateX(-50%)",
						}}
					>
						<div className="px-1 py-0.5 rounded bg-foreground text-background text-[9px] font-mono leading-none shadow-sm -mt-0.5">
							{formatPlayheadTime(hoverTimeMs)}
						</div>
						<div className="w-[1px] flex-1 bg-foreground/40 mt-0.5" />
					</div>
				)}
			</div>
		</div>
	);
}
