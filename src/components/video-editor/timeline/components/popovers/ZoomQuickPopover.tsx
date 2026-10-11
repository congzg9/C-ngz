import { Copy, Crosshair, CursorClick, Trash, X } from "@phosphor-icons/react";
import React, { memo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ZOOM_SPEED_OPTIONS, type ZoomDepth, type ZoomMode, type ZoomSpeed } from "../../../types";

export interface ZoomQuickPopoverProps {
	id: string;
	span: { start: number; end: number };
	depth?: ZoomDepth;
	mode: ZoomMode;
	pan?: boolean;
	centerPx: number;
	onDepthChange?: (depth: ZoomDepth) => void;
	onModeChange: (mode: ZoomMode) => void;
	onPanChange?: (pan: boolean) => void;
	onDuplicate?: (id: string) => void;
	onDelete: (id: string) => void;
	onClose: () => void;
	zoomSpeed?: ZoomSpeed;
	onZoomSpeedChange?: (speed: ZoomSpeed) => void;
}

export const ZoomQuickPopover = memo(function ZoomQuickPopover({
	id,
	span,
	mode = "auto",
	pan,
	centerPx,
	onModeChange,
	onPanChange,
	onDuplicate,
	onDelete,
	onClose,
	zoomSpeed = 2,
	onZoomSpeedChange,
}: ZoomQuickPopoverProps) {
	const durationSec = Math.max(0, (span.end - span.start) / 1000).toFixed(1);
	const isPanActive = pan !== undefined ? pan : mode !== "manual";

	// Stop click & mousedown propagation to prevent timeline seeking/deselection
	const handleStopPropagation = (e: React.SyntheticEvent) => {
		e.stopPropagation();
	};

	// Keyboard shortcuts while popover is active
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			) {
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
				return;
			}

			if (e.key >= "1" && e.key <= "4" && !e.ctrlKey && !e.metaKey && !e.altKey) {
				const selectedSpeed = parseInt(e.key, 10) as ZoomSpeed;
				if (
					onZoomSpeedChange &&
					(ZOOM_SPEED_OPTIONS as readonly number[]).includes(selectedSpeed)
				) {
					e.preventDefault();
					onZoomSpeedChange(selectedSpeed);
					return;
				}
			}

			if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				onModeChange(mode === "auto" ? "manual" : "auto");
				return;
			}

			if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey && !e.altKey) {
				if (onPanChange) {
					e.preventDefault();
					onPanChange(!isPanActive);
				}
				return;
			}

			if (
				(e.key.toLowerCase() === "d" && !e.ctrlKey) ||
				(e.key.toLowerCase() === "d" && (e.ctrlKey || e.metaKey))
			) {
				if (onDuplicate) {
					e.preventDefault();
					onDuplicate(id);
				}
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		id,
		isPanActive,
		mode,
		onClose,
		onDelete,
		onDuplicate,
		onModeChange,
		onPanChange,
		onZoomSpeedChange,
	]);

	return (
		<div
			className="absolute bottom-[calc(100%+8px)] z-[70] pointer-events-auto select-none"
			style={{
				left: `${centerPx}px`,
				transform: "translateX(-50%)",
			}}
			onMouseDown={handleStopPropagation}
			onClick={handleStopPropagation}
			onPointerDown={handleStopPropagation}
		>
			<div className="relative flex items-center gap-1.5 rounded-xl border border-border/70 bg-popover/95 text-popover-foreground px-2 py-1.5 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10">
				{/* Duration Badge */}
				<span className="text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 tabular-nums">
					{durationSec}s
				</span>

				<div className="h-4 w-[1px] bg-border/80 mx-0.5" />

				{/* Zoom Speed Options */}
				<div className="flex items-center gap-0.5 bg-muted/50 p-0.5 rounded-lg border border-border/40">
					{ZOOM_SPEED_OPTIONS.map((speed) => {
						const isSelected = zoomSpeed === speed;
						return (
							<button
								key={speed}
								type="button"
								onClick={() => onZoomSpeedChange?.(speed)}
								title={`Tốc độ zoom ${speed}x (Phím ${speed})`}
								className={cn(
									"px-2 py-0.5 text-[11px] rounded font-medium transition-all",
									isSelected
										? "bg-violet-600 text-white font-semibold shadow-sm"
										: "text-muted-foreground hover:text-foreground hover:bg-background/60",
								)}
							>
								{speed}x
							</button>
						);
					})}
				</div>

				<div className="h-4 w-[1px] bg-border/80 mx-0.5" />

				{/* Mode Toggle (Auto vs Manual) */}
				<button
					type="button"
					onClick={() => onModeChange(mode === "auto" ? "manual" : "auto")}
					title={
						mode === "auto"
							? "Chế độ: Chọn vị trí tự động theo click chuột (Auto)"
							: "Chế độ: Chọn vị trí cố định theo tọa độ bạn đặt (Manual)"
					}
					className={cn(
						"flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium rounded-md border transition-all",
						mode === "auto"
							? "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400"
							: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
					)}
				>
					{mode === "auto" ? (
						<>
							<CursorClick className="h-3 w-3" weight="bold" />
							<span>Auto</span>
						</>
					) : (
						<>
							<Crosshair className="h-3 w-3" weight="bold" />
							<span>Cố định</span>
						</>
					)}
				</button>

				{/* Quick Actions: Duplicate, Delete, Close */}
				<div className="flex items-center gap-0.5">
					{onDuplicate && (
						<button
							type="button"
							onClick={() => onDuplicate(id)}
							title="Nhân bản ô Zoom (D / Ctrl+D)"
							className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						>
							<Copy className="h-3.5 w-3.5" />
						</button>
					)}
					<button
						type="button"
						onClick={() => onDelete(id)}
						title="Xóa ô Zoom (Del / Backspace)"
						className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/15 hover:text-red-500 transition-colors"
					>
						<Trash className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={onClose}
						title="Đóng bảng chỉnh nhanh (Esc)"
						className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>

				{/* Bottom pointer arrow */}
				<div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b border-border/70 bg-popover/95" />
			</div>
		</div>
	);
});
