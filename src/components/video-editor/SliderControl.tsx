import type { PointerEvent as ReactPointerEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SliderControlProps {
	label: string;
	value: number;
	defaultValue: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	formatValue: (value: number) => string;
	parseInput: (text: string) => number | null;
	accentColor?: "purple" | "blue";
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function quantizeToStep(value: number, min: number, step: number) {
	if (!(step > 0)) {
		return value;
	}
	return min + Math.round((value - min) / step) * step;
}

export const SliderControl = memo(function SliderControl({
	label,
	value,
	defaultValue: _defaultValue,
	min,
	max,
	step,
	onChange,
	formatValue,
	parseInput,
	accentColor = "blue",
}: SliderControlProps) {
	const trackRef = useRef<HTMLDivElement | null>(null);
	const boundsRef = useRef<DOMRect | null>(null);
	const requestRef = useRef<number | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editText, setEditText] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);

	const pct = Math.min(100, Math.max(0, ((value - min) / (max - min || 1)) * 100));

	const updateValue = useCallback(
		(clientX: number) => {
			const bounds = boundsRef.current;
			if (!bounds || bounds.width <= 0) {
				return;
			}

			const normalized = clamp((clientX - bounds.left) / bounds.width, 0, 1);
			const rawValue = min + normalized * (max - min);
			const nextValue = clamp(quantizeToStep(rawValue, min, step), min, max);
			const finalValue = Number(nextValue.toFixed(6));

			onChange(finalValue);
		},
		[max, min, onChange, step],
	);

	const handlePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (isEditing) return;
			event.preventDefault();
			const pointerId = event.pointerId;
			const target = event.currentTarget;

			boundsRef.current = target.getBoundingClientRect();
			target.setPointerCapture(pointerId);
			updateValue(event.clientX);

			const handlePointerMove = (moveEvent: PointerEvent) => {
				if (moveEvent.pointerId !== pointerId) return;

				if (requestRef.current) {
					cancelAnimationFrame(requestRef.current);
				}

				requestRef.current = requestAnimationFrame(() => {
					updateValue(moveEvent.clientX);
				});
			};

			const finishPointer = (finishEvent: PointerEvent) => {
				if (finishEvent.pointerId !== pointerId) return;

				if (requestRef.current) {
					cancelAnimationFrame(requestRef.current);
					requestRef.current = null;
				}

				if (finishEvent.type === "pointerup") {
					updateValue(finishEvent.clientX);
				}

				target.releasePointerCapture(pointerId);
				target.removeEventListener("pointermove", handlePointerMove);
				target.removeEventListener("pointerup", finishPointer);
				target.removeEventListener("pointercancel", finishPointer);
				boundsRef.current = null;
			};

			target.addEventListener("pointermove", handlePointerMove);
			target.addEventListener("pointerup", finishPointer);
			target.addEventListener("pointercancel", finishPointer);
		},
		[isEditing, updateValue],
	);

	const handleValueClick = () => {
		setEditText(formatValue(value));
		setIsEditing(true);
	};

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const commitEdit = () => {
		setIsEditing(false);
		if (parseInput) {
			const parsed = parseInput(editText);
			if (parsed !== null && !isNaN(parsed)) {
				onChange(clamp(quantizeToStep(parsed, min, step), min, max));
			}
		}
	};

	const accentBarClass =
		accentColor === "purple"
			? "bg-gradient-to-r from-purple-500 to-indigo-500"
			: "bg-gradient-to-r from-blue-500 to-sky-500";

	return (
		<div className="flex flex-col gap-1.5 py-1 w-full select-none">
			{(Boolean(label) || Boolean(formatValue(value))) && (
				<div className="flex items-center justify-between min-h-[20px] px-0.5">
					{label ? (
						<span className="text-[11px] font-medium text-foreground/80 tracking-tight">
							{label}
						</span>
					) : (
						<span />
					)}
					{isEditing ? (
						<input
							ref={inputRef}
							type="text"
							value={editText}
							onChange={(e) => setEditText(e.target.value)}
							onBlur={commitEdit}
							onKeyDown={(e) => {
								if (e.key === "Enter") commitEdit();
								if (e.key === "Escape") setIsEditing(false);
							}}
							className="h-5 w-16 px-1 text-right text-[11px] font-mono rounded border border-blue-500 bg-background text-foreground outline-none ring-1 ring-blue-500/30"
						/>
					) : (
						<button
							type="button"
							onClick={handleValueClick}
							title="Click to edit value"
							className="h-5 px-1.5 flex items-center justify-center rounded-md bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-foreground/[0.06] text-[11px] font-mono tabular-nums text-foreground/90 font-medium transition-colors cursor-text"
						>
							{formatValue(value)}
						</button>
					)}
				</div>
			)}
			<div
				ref={trackRef}
				role="slider"
				tabIndex={0}
				aria-label={label || "Slider"}
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={value}
				aria-valuetext={formatValue(value)}
				onPointerDown={handlePointerDown}
				onKeyDown={(event) => {
					if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
						event.preventDefault();
						onChange(clamp(quantizeToStep(value - step, min, step), min, max));
					}
					if (event.key === "ArrowRight" || event.key === "ArrowUp") {
						event.preventDefault();
						onChange(clamp(quantizeToStep(value + step, min, step), min, max));
					}
				}}
				className="relative flex items-center h-4 w-full cursor-pointer group outline-none"
			>
				{/* Track background */}
				<div className="absolute inset-x-0 h-1.5 rounded-full bg-foreground/[0.08] group-hover:bg-foreground/[0.12] transition-colors overflow-hidden">
					{/* Active Fill */}
					<div
						className={cn("h-full rounded-full transition-none", accentBarClass)}
						style={{ width: `${pct}%` }}
					/>
				</div>
				{/* Thumb handle */}
				<div
					className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.22)] border border-black/10 ring-2 ring-blue-500/20 group-hover:scale-110 active:scale-95 transition-transform pointer-events-none"
					style={{ left: `${pct}%` }}
				/>
			</div>
		</div>
	);
});
