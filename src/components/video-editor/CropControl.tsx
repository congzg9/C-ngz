import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import { ArrowCounterClockwise, CornersOut } from "@phosphor-icons/react";

export interface CropRegion {
	x: number; // 0-1 normalized
	y: number; // 0-1 normalized
	width: number; // 0-1 normalized
	height: number; // 0-1 normalized
}

interface CropControlProps {
	videoElement: HTMLVideoElement | null;
	cropRegion: CropRegion;
	onCropChange: (region: CropRegion) => void;
	aspectRatio?: AspectRatio;
}

export type CropRatioOption =
	| "free"
	| "original"
	| "16:9"
	| "9:16"
	| "1:1"
	| "4:5"
	| "4:3"
	| "16:10"
	| "21:9";

interface RatioPreset {
	id: CropRatioOption;
	label: string;
	subLabel?: string;
	ratio: number | null; // null for free, -1 for original
}

const RATIO_PRESETS: RatioPreset[] = [
	{ id: "free", label: "Tự do", ratio: null },
	{ id: "original", label: "Gốc", ratio: -1 },
	{ id: "16:9", label: "16:9", subLabel: "Ngang", ratio: 16 / 9 },
	{ id: "9:16", label: "9:16", subLabel: "Dọc", ratio: 9 / 16 },
	{ id: "1:1", label: "1:1", subLabel: "Vuông", ratio: 1 },
	{ id: "4:5", label: "4:5", subLabel: "Dọc", ratio: 4 / 5 },
	{ id: "4:3", label: "4:3", ratio: 4 / 3 },
	{ id: "16:10", label: "16:10", ratio: 16 / 10 },
	{ id: "21:9", label: "21:9", subLabel: "Rộng", ratio: 21 / 9 },
];

type DragHandle =
	| "move"
	| "top"
	| "right"
	| "bottom"
	| "left"
	| "nw"
	| "ne"
	| "se"
	| "sw"
	| null;

export function CropControl({
	videoElement,
	cropRegion,
	onCropChange,
}: CropControlProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [selectedRatio, setSelectedRatio] = useState<CropRatioOption>("free");
	const [isDragging, setIsDragging] = useState<DragHandle>(null);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialCrop, setInitialCrop] = useState<CropRegion>(cropRegion);

	const videoAspectRatio = videoElement
		? (videoElement.videoWidth || 1920) / (videoElement.videoHeight || 1080)
		: 16 / 9;

	useEffect(() => {
		if (!videoElement || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) return;

		canvas.width = videoElement.videoWidth || 1920;
		canvas.height = videoElement.videoHeight || 1080;

		let animationFrameId = 0;
		let isCancelled = false;

		const draw = () => {
			if (isCancelled) {
				return;
			}

			if (videoElement.readyState >= 2) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
			}
			animationFrameId = requestAnimationFrame(draw);
		};

		animationFrameId = requestAnimationFrame(draw);
		return () => {
			isCancelled = true;
			cancelAnimationFrame(animationFrameId);
		};
	}, [videoElement]);

	const getContainerRect = () => {
		return (
			containerRef.current?.getBoundingClientRect() || {
				width: 0,
				height: 0,
				left: 0,
				top: 0,
			}
		);
	};

	const handleSelectRatio = (preset: RatioPreset) => {
		setSelectedRatio(preset.id);
		if (preset.id === "free") {
			return;
		}

		const targetRatio =
			preset.ratio === -1 ? videoAspectRatio : (preset.ratio ?? videoAspectRatio);
		const normalizedRatio = targetRatio / videoAspectRatio;

		let newW: number;
		let newH: number;

		if (normalizedRatio >= 1) {
			newW = 1;
			newH = 1 / normalizedRatio;
		} else {
			newH = 1;
			newW = normalizedRatio;
		}

		// Center the new crop box in the video frame
		const newX = (1 - newW) / 2;
		const newY = (1 - newH) / 2;

		const nextCrop: CropRegion = {
			x: Math.max(0, Math.min(1 - newW, newX)),
			y: Math.max(0, Math.min(1 - newH, newY)),
			width: Math.min(1, newW),
			height: Math.min(1, newH),
		};

		onCropChange(nextCrop);
	};

	const handleResetCrop = () => {
		setSelectedRatio("free");
		onCropChange({ x: 0, y: 0, width: 1, height: 1 });
	};

	const handleCenterCrop = () => {
		const newX = (1 - cropRegion.width) / 2;
		const newY = (1 - cropRegion.height) / 2;
		onCropChange({
			...cropRegion,
			x: Math.max(0, Math.min(1 - cropRegion.width, newX)),
			y: Math.max(0, Math.min(1 - cropRegion.height, newY)),
		});
	};

	const handlePointerDown = (e: React.PointerEvent, handle: DragHandle) => {
		e.stopPropagation();
		e.preventDefault();
		const rect = getContainerRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return;
		}

		setIsDragging(handle);
		setDragStart({
			x: (e.clientX - rect.left) / rect.width,
			y: (e.clientY - rect.top) / rect.height,
		});
		setInitialCrop(cropRegion);

		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDragging) return;

		const rect = getContainerRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return;
		}

		const currentX = (e.clientX - rect.left) / rect.width;
		const currentY = (e.clientY - rect.top) / rect.height;
		const deltaX = currentX - dragStart.x;
		const deltaY = currentY - dragStart.y;

		if (isDragging === "move") {
			const newX = Math.max(
				0,
				Math.min(1 - initialCrop.width, initialCrop.x + deltaX),
			);
			const newY = Math.max(
				0,
				Math.min(1 - initialCrop.height, initialCrop.y + deltaY),
			);
			onCropChange({ ...initialCrop, x: newX, y: newY });
			return;
		}

		const minSize = 0.05;

		if (selectedRatio === "free") {
			const newCrop = { ...initialCrop };

			switch (isDragging) {
				case "top": {
					const newY = Math.max(
						0,
						Math.min(
							initialCrop.y + deltaY,
							initialCrop.y + initialCrop.height - minSize,
						),
					);
					newCrop.y = newY;
					newCrop.height = initialCrop.y + initialCrop.height - newY;
					break;
				}
				case "bottom": {
					newCrop.height = Math.max(
						minSize,
						Math.min(initialCrop.height + deltaY, 1 - initialCrop.y),
					);
					break;
				}
				case "left": {
					const newX = Math.max(
						0,
						Math.min(
							initialCrop.x + deltaX,
							initialCrop.x + initialCrop.width - minSize,
						),
					);
					newCrop.x = newX;
					newCrop.width = initialCrop.x + initialCrop.width - newX;
					break;
				}
				case "right": {
					newCrop.width = Math.max(
						minSize,
						Math.min(initialCrop.width + deltaX, 1 - initialCrop.x),
					);
					break;
				}
				case "nw": {
					const newX = Math.max(
						0,
						Math.min(
							initialCrop.x + deltaX,
							initialCrop.x + initialCrop.width - minSize,
						),
					);
					const newY = Math.max(
						0,
						Math.min(
							initialCrop.y + deltaY,
							initialCrop.y + initialCrop.height - minSize,
						),
					);
					newCrop.x = newX;
					newCrop.width = initialCrop.x + initialCrop.width - newX;
					newCrop.y = newY;
					newCrop.height = initialCrop.y + initialCrop.height - newY;
					break;
				}
				case "ne": {
					const newY = Math.max(
						0,
						Math.min(
							initialCrop.y + deltaY,
							initialCrop.y + initialCrop.height - minSize,
						),
					);
					newCrop.width = Math.max(
						minSize,
						Math.min(initialCrop.width + deltaX, 1 - initialCrop.x),
					);
					newCrop.y = newY;
					newCrop.height = initialCrop.y + initialCrop.height - newY;
					break;
				}
				case "se": {
					newCrop.width = Math.max(
						minSize,
						Math.min(initialCrop.width + deltaX, 1 - initialCrop.x),
					);
					newCrop.height = Math.max(
						minSize,
						Math.min(initialCrop.height + deltaY, 1 - initialCrop.y),
					);
					break;
				}
				case "sw": {
					const newX = Math.max(
						0,
						Math.min(
							initialCrop.x + deltaX,
							initialCrop.x + initialCrop.width - minSize,
						),
					);
					newCrop.x = newX;
					newCrop.width = initialCrop.x + initialCrop.width - newX;
					newCrop.height = Math.max(
						minSize,
						Math.min(initialCrop.height + deltaY, 1 - initialCrop.y),
					);
					break;
				}
			}

			onCropChange(newCrop);
			return;
		}

		// Fixed aspect ratio dragging
		const preset = RATIO_PRESETS.find((p) => p.id === selectedRatio);
		const targetRatio =
			preset?.ratio === -1 ? videoAspectRatio : (preset?.ratio ?? videoAspectRatio);
		const normRatio = targetRatio / videoAspectRatio;

		if (isDragging === "se") {
			const anchorX = initialCrop.x;
			const anchorY = initialCrop.y;
			const maxW = 1 - anchorX;
			const maxH = 1 - anchorY;

			let w = initialCrop.width + deltaX;
			let h = w / normRatio;
			if (h > maxH) {
				h = maxH;
				w = h * normRatio;
			}
			if (w > maxW) {
				w = maxW;
				h = w / normRatio;
			}
			w = Math.max(minSize * normRatio, Math.min(maxW, w));
			h = w / normRatio;
			onCropChange({ x: anchorX, y: anchorY, width: w, height: h });
		} else if (isDragging === "nw") {
			const anchorX = initialCrop.x + initialCrop.width;
			const anchorY = initialCrop.y + initialCrop.height;
			const maxW = anchorX;
			const maxH = anchorY;

			let w = initialCrop.width - deltaX;
			let h = w / normRatio;
			if (h > maxH) {
				h = maxH;
				w = h * normRatio;
			}
			if (w > maxW) {
				w = maxW;
				h = w / normRatio;
			}
			w = Math.max(minSize * normRatio, Math.min(maxW, w));
			h = w / normRatio;
			onCropChange({ x: anchorX - w, y: anchorY - h, width: w, height: h });
		} else if (isDragging === "ne") {
			const anchorX = initialCrop.x;
			const anchorY = initialCrop.y + initialCrop.height;
			const maxW = 1 - anchorX;
			const maxH = anchorY;

			let w = initialCrop.width + deltaX;
			let h = w / normRatio;
			if (h > maxH) {
				h = maxH;
				w = h * normRatio;
			}
			if (w > maxW) {
				w = maxW;
				h = w / normRatio;
			}
			w = Math.max(minSize * normRatio, Math.min(maxW, w));
			h = w / normRatio;
			onCropChange({ x: anchorX, y: anchorY - h, width: w, height: h });
		} else if (isDragging === "sw") {
			const anchorX = initialCrop.x + initialCrop.width;
			const anchorY = initialCrop.y;
			const maxW = anchorX;
			const maxH = 1 - anchorY;

			let w = initialCrop.width - deltaX;
			let h = w / normRatio;
			if (h > maxH) {
				h = maxH;
				w = h * normRatio;
			}
			if (w > maxW) {
				w = maxW;
				h = w / normRatio;
			}
			w = Math.max(minSize * normRatio, Math.min(maxW, w));
			h = w / normRatio;
			onCropChange({ x: anchorX - w, y: anchorY, width: w, height: h });
		} else if (isDragging === "right" || isDragging === "left") {
			const isLeft = isDragging === "left";
			const currentW = isLeft
				? initialCrop.width - deltaX
				: initialCrop.width + deltaX;
			const maxW = isLeft ? initialCrop.x + initialCrop.width : 1 - initialCrop.x;
			let w = Math.max(minSize * normRatio, Math.min(maxW, currentW));
			let h = w / normRatio;
			if (h > 1) {
				h = 1;
				w = h * normRatio;
			}
			const centerY = initialCrop.y + initialCrop.height / 2;
			const y = Math.max(0, Math.min(1 - h, centerY - h / 2));
			const x = isLeft ? initialCrop.x + initialCrop.width - w : initialCrop.x;
			onCropChange({ x, y, width: w, height: h });
		} else if (isDragging === "top" || isDragging === "bottom") {
			const isTop = isDragging === "top";
			const currentH = isTop
				? initialCrop.height - deltaY
				: initialCrop.height + deltaY;
			const maxH = isTop ? initialCrop.y + initialCrop.height : 1 - initialCrop.y;
			let h = Math.max(minSize, Math.min(maxH, currentH));
			let w = h * normRatio;
			if (w > 1) {
				w = 1;
				h = w / normRatio;
			}
			const centerX = initialCrop.x + initialCrop.width / 2;
			const x = Math.max(0, Math.min(1 - w, centerX - w / 2));
			const y = isTop ? initialCrop.y + initialCrop.height - h : initialCrop.y;
			onCropChange({ x, y, width: w, height: h });
		}
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		if (isDragging) {
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* Pointer capture may already be released */
			}
		}
		setIsDragging(null);
	};

	const cropPixelX = cropRegion.x * 100;
	const cropPixelY = cropRegion.y * 100;
	const cropPixelWidth = cropRegion.width * 100;
	const cropPixelHeight = cropRegion.height * 100;

	const isVideoPortrait = videoAspectRatio < 1;
	const maxContainerWidth = isVideoPortrait ? "42vw" : "75vw";
	const maxContainerHeight = "62vh";

	return (
		<div className="w-full flex flex-col items-center">
			{/* Aspect Ratio Toolbar */}
			<div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 mb-4 px-2">
				<div className="flex flex-wrap items-center gap-1.5">
					{RATIO_PRESETS.map((preset) => {
						const isActive = selectedRatio === preset.id;
						return (
							<button
								key={preset.id}
								type="button"
								onClick={() => handleSelectRatio(preset)}
								className={cn(
									"px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1 border cursor-pointer select-none",
									isActive
										? "bg-[#2563EB] border-[#2563EB] text-white shadow-sm font-semibold"
										: "bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
								)}
							>
								<span>{preset.label}</span>
								{preset.subLabel && (
									<span
										className={cn(
											"text-[10px]",
											isActive ? "text-white/80" : "text-muted-foreground/80",
										)}
									>
										({preset.subLabel})
									</span>
								)}
							</button>
						);
					})}
				</div>

				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={handleCenterCrop}
						title="Căn giữa vùng cắt"
						className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-foreground/5 border border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
					>
						<CornersOut className="w-3.5 h-3.5" />
						<span>Căn giữa</span>
					</button>
					<button
						type="button"
						onClick={handleResetCrop}
						title="Đặt lại toàn khung hình"
						className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-foreground/5 border border-foreground/10 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
					>
						<ArrowCounterClockwise className="w-3.5 h-3.5" />
						<span>Đặt lại</span>
					</button>
				</div>
			</div>

			{/* Canvas Preview and Crop Area */}
			<div
				ref={containerRef}
				className="relative w-full bg-black rounded-xl overflow-visible cursor-default select-none shadow-2xl border border-foreground/10"
				style={{
					aspectRatio: videoAspectRatio,
					maxWidth: maxContainerWidth,
					maxHeight: maxContainerHeight,
					margin: "0 auto",
				}}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
			>
				<canvas
					ref={canvasRef}
					className="w-full h-full rounded-xl"
					style={{ imageRendering: "auto" }}
				/>

				{/* Dark Mask Overlay outside crop box */}
				<div
					className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
					style={{ transition: "none" }}
				>
					<svg
						width="100%"
						height="100%"
						className="absolute inset-0"
						style={{ transition: "none" }}
					>
						<defs>
							<mask id="cropMask">
								<rect width="100%" height="100%" fill="white" />
								<rect
									x={`${cropPixelX}%`}
									y={`${cropPixelY}%`}
									width={`${cropPixelWidth}%`}
									height={`${cropPixelHeight}%`}
									fill="black"
									style={{ transition: "none" }}
								/>
							</mask>
						</defs>
						<rect
							width="100%"
							height="100%"
							fill="black"
							fillOpacity="0.65"
							mask="url(#cropMask)"
							style={{ transition: "none" }}
						/>
					</svg>
				</div>

				{/* Inside Crop Box Interactive Area: Move & Rule-of-Thirds Grid */}
				<div
					className="absolute cursor-move pointer-events-auto border border-[#2563EB]/90"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						width: `${cropPixelWidth}%`,
						height: `${cropPixelHeight}%`,
						boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "move")}
				>
					{/* Rule-of-Thirds Grid */}
					<div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30 hover:opacity-50 transition-opacity">
						<div className="border-r border-b border-white" />
						<div className="border-r border-b border-white" />
						<div className="border-b border-white" />
						<div className="border-r border-b border-white" />
						<div className="border-r border-b border-white" />
						<div className="border-b border-white" />
						<div className="border-r border-white" />
						<div className="border-r border-white" />
						<div />
					</div>
				</div>

				{/* 4 Corner Handles (L-shaped professional crop markers) */}
				{/* Top-Left NW */}
				<div
					className="absolute z-30 pointer-events-auto cursor-nwse-resize"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						transform: "translate(-50%, -50%)",
						padding: "8px",
					}}
					onPointerDown={(e) => handlePointerDown(e, "nw")}
				>
					<div className="w-4 h-4 border-t-[3px] border-l-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
				</div>

				{/* Top-Right NE */}
				<div
					className="absolute z-30 pointer-events-auto cursor-nesw-resize"
					style={{
						left: `${cropPixelX + cropPixelWidth}%`,
						top: `${cropPixelY}%`,
						transform: "translate(-50%, -50%)",
						padding: "8px",
					}}
					onPointerDown={(e) => handlePointerDown(e, "ne")}
				>
					<div className="w-4 h-4 border-t-[3px] border-r-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.8)] ml-auto" />
				</div>

				{/* Bottom-Left SW */}
				<div
					className="absolute z-30 pointer-events-auto cursor-nesw-resize"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY + cropPixelHeight}%`,
						transform: "translate(-50%, -50%)",
						padding: "8px",
					}}
					onPointerDown={(e) => handlePointerDown(e, "sw")}
				>
					<div className="w-4 h-4 border-b-[3px] border-l-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.8)] mt-auto" />
				</div>

				{/* Bottom-Right SE */}
				<div
					className="absolute z-30 pointer-events-auto cursor-nwse-resize"
					style={{
						left: `${cropPixelX + cropPixelWidth}%`,
						top: `${cropPixelY + cropPixelHeight}%`,
						transform: "translate(-50%, -50%)",
						padding: "8px",
					}}
					onPointerDown={(e) => handlePointerDown(e, "se")}
				>
					<div className="w-4 h-4 border-b-[3px] border-r-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.8)] ml-auto mt-auto" />
				</div>

				{/* 4 Edge Grab Bars */}
				{/* Top */}
				<div
					className="absolute z-20 pointer-events-auto cursor-ns-resize flex items-center justify-center"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						width: `${cropPixelWidth}%`,
						height: "14px",
						transform: "translateY(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "top")}
				>
					<div className="w-8 h-1 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
				</div>

				{/* Bottom */}
				<div
					className="absolute z-20 pointer-events-auto cursor-ns-resize flex items-center justify-center"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY + cropPixelHeight}%`,
						width: `${cropPixelWidth}%`,
						height: "14px",
						transform: "translateY(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "bottom")}
				>
					<div className="w-8 h-1 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
				</div>

				{/* Left */}
				<div
					className="absolute z-20 pointer-events-auto cursor-ew-resize flex items-center justify-center"
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						width: "14px",
						transform: "translateX(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "left")}
				>
					<div className="h-8 w-1 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
				</div>

				{/* Right */}
				<div
					className="absolute z-20 pointer-events-auto cursor-ew-resize flex items-center justify-center"
					style={{
						left: `${cropPixelX + cropPixelWidth}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						width: "14px",
						transform: "translateX(-50%)",
					}}
					onPointerDown={(e) => handlePointerDown(e, "right")}
				>
					<div className="h-8 w-1 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
				</div>
			</div>
		</div>
	);
}
