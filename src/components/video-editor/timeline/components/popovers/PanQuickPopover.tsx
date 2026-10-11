import { ArrowsOutCardinal, Copy, Trash, X } from "@phosphor-icons/react";
import React, { memo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { PAN_SPEED_OPTIONS, type PanSpeed } from "../../../types";

export interface PanQuickPopoverProps {
	id: string;
	span: { start: number; end: number };
	speed?: PanSpeed;
	centerPx: number;
	onSpeedChange?: (speed: PanSpeed) => void;
	onDuplicate?: (id: string) => void;
	onDelete: (id: string) => void;
	onClose: () => void;
}

export const PanQuickPopover = memo(function PanQuickPopover({
	id,
	span,
	speed = 2,
	centerPx,
	onSpeedChange,
	onDuplicate,
	onDelete,
	onClose,
}: PanQuickPopoverProps) {
	const durationSec = Math.max(0, (span.end - span.start) / 1000).toFixed(1);

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
				const selectedSpeed = parseInt(e.key, 10) as PanSpeed;
				if (
					onSpeedChange &&
					(PAN_SPEED_OPTIONS as readonly number[]).includes(selectedSpeed)
				) {
					e.preventDefault();
					onSpeedChange(selectedSpeed);
					return;
				}
			}

			if (e.key === "Delete" || e.key === "Backspace") {
				e.preventDefault();
				onDelete(id);
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
	}, [id, onClose, onDelete, onDuplicate, onSpeedChange]);

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

				{/* Pan Speed Options */}
				<div className="flex items-center gap-0.5 bg-muted/50 p-0.5 rounded-lg border border-border/40">
					{PAN_SPEED_OPTIONS.map((s) => {
						const isSelected = (speed ?? 2) === s;
						const speedTitles: Record<number, string> = {
							1: "Tốc độ 1x (Siêu mượt / Cinematic)",
							2: "Tốc độ 2x (Mặc định mượt mà)",
							3: "Tốc độ 3x (Nhanh)",
							4: "Tốc độ 4x (Bám sát tức thì)",
						};
						return (
							<button
								key={s}
								type="button"
								onClick={() => onSpeedChange?.(s)}
								title={speedTitles[s] || `Tốc độ ${s}x (Phím ${s})`}
								className={cn(
									"px-2 py-0.5 text-[11px] rounded font-medium transition-all",
									isSelected
										? "bg-emerald-600 text-white font-semibold shadow-sm"
										: "text-muted-foreground hover:text-foreground hover:bg-background/60",
								)}
							>
								{s}x
							</button>
						);
					})}
				</div>

				<div className="h-4 w-[1px] bg-border/80 mx-0.5" />

				{/* Pan Indicator */}
				<div className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
					<ArrowsOutCardinal className="h-3 w-3" weight="bold" />
					<span className="font-semibold">Pan (Theo chuột)</span>
				</div>

				<div className="h-4 w-[1px] bg-border/80 mx-0.5" />

				{/* Quick Actions: Duplicate, Delete, Close */}
				<div className="flex items-center gap-0.5">
					{onDuplicate && (
						<button
							type="button"
							onClick={() => onDuplicate(id)}
							title="Nhân bản ô Pan (D / Ctrl+D)"
							className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						>
							<Copy className="h-3.5 w-3.5" />
						</button>
					)}
					<button
						type="button"
						onClick={() => onDelete(id)}
						title="Xóa ô Pan (Del / Backspace)"
						className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/15 hover:text-red-500 transition-colors"
					>
						<Trash className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={onClose}
						title="Đóng (Esc)"
						className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
});
