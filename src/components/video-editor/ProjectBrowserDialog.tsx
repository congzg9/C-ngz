import { FolderOpen as FolderOpenIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import { toFileUrl } from "./projectPersistence";

export type ProjectLibraryEntry = {
	path: string;
	name: string;
	updatedAt: number;
	thumbnailPath: string | null;
	videoPath?: string | null;
	isCurrent: boolean;
	isInProjectsDirectory: boolean;
};

type ProjectBrowserDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entries: ProjectLibraryEntry[];
	onOpenProject: (projectPath: string) => void;
	anchorRef?: React.RefObject<HTMLElement | null>;
	preferredDirection?: "up" | "down" | "auto";
	onPanelHeightChange?: (height: number) => void;
	renderMode?: "floating" | "inline";
	currentThumbnailUrl?: string | null;
};

function ProjectThumbnail({
	thumbnailSrc,
	videoPath,
	loadingText = "Đang tải xem trước...",
	noPreviewText = "Chưa có xem trước",
}: {
	thumbnailSrc: string | null;
	videoPath?: string | null;
	loadingText?: string;
	noPreviewText?: string;
}) {
	const [videoReady, setVideoReady] = useState(false);

	if (thumbnailSrc) {
		return (
			<img
				src={thumbnailSrc}
				alt=""
				className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
				draggable={false}
			/>
		);
	}

	if (videoPath) {
		const videoUrl = toFileUrl(videoPath);
		return (
			<div className="relative h-full w-full bg-slate-950 overflow-hidden">
				<video
					src={videoUrl}
					className={`h-full w-full object-cover transition-opacity duration-300 group-hover:scale-[1.03] ${videoReady ? "opacity-100" : "opacity-0"}`}
					muted
					playsInline
					preload="metadata"
					onLoadedMetadata={(e) => {
						try {
							const v = e.currentTarget;
							v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
						} catch (_) {}
					}}
					onSeeked={() => setVideoReady(true)}
					onLoadedData={() => setVideoReady(true)}
				/>
				{!videoReady && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-medium text-white/50">
						{loadingText}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[10px] font-medium text-white/40">
			{noPreviewText}
		</div>
	);
}

export default function ProjectBrowserDialog({
	open,
	onOpenChange,
	entries,
	onOpenProject,
	anchorRef,
	preferredDirection = "auto",
	onPanelHeightChange,
	renderMode = "floating",
	currentThumbnailUrl,
}: ProjectBrowserDialogProps) {
	const t = useScopedT("editor");
	const panelRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState({ top: 72, left: 16, maxHeight: 360 });
	const visibleEntries = useMemo(() => entries.slice(0, 24), [entries]);

	const updatePosition = useCallback(() => {
		if (typeof window === "undefined") {
			return;
		}

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const margin = 12;
		const gap = 8;
		const fallbackMaxHeight = Math.min(360, viewportHeight - margin * 2);
		const panelWidth = Math.min(320, Math.max(248, viewportWidth - margin * 2));
		const panelHeight = panelRef.current?.offsetHeight ?? fallbackMaxHeight;
		const anchorRect = anchorRef?.current?.getBoundingClientRect();
		const availableAbove = anchorRect
			? Math.max(120, anchorRect.top - margin - gap)
			: fallbackMaxHeight;
		const availableBelow = anchorRect
			? Math.max(120, viewportHeight - anchorRect.bottom - margin - gap)
			: fallbackMaxHeight;
		const direction =
			preferredDirection === "auto"
				? availableAbove > availableBelow
					? "up"
					: "down"
				: preferredDirection;
		const maxHeight = Math.min(
			fallbackMaxHeight,
			direction === "up" ? availableAbove : availableBelow,
		);

		const nextTop = anchorRect
			? direction === "up"
				? Math.max(margin, anchorRect.top - Math.min(panelHeight, maxHeight) - gap)
				: Math.min(
						anchorRect.bottom + gap,
						Math.max(
							margin,
							viewportHeight - Math.min(panelHeight, maxHeight) - margin,
						),
					)
			: Math.min(
					56,
					Math.max(margin, viewportHeight - Math.min(panelHeight, maxHeight) - margin),
				);
		const alignedLeft = anchorRect
			? anchorRect.left + panelWidth <= viewportWidth - margin
				? anchorRect.left
				: anchorRect.right - panelWidth
			: viewportWidth - panelWidth - 16;

		setPosition({
			top: Math.max(margin, nextTop),
			left: Math.max(margin, Math.min(alignedLeft, viewportWidth - panelWidth - margin)),
			maxHeight,
		});
	}, [anchorRef, preferredDirection]);

	useEffect(() => {
		if (!open) {
			return;
		}

		updatePosition();

		const handleViewportChange = () => updatePosition();
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, true);

		return () => {
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange, true);
		};
	}, [open, updatePosition]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) {
				return;
			}

			if (panelRef.current?.contains(target) || anchorRef?.current?.contains(target)) {
				return;
			}

			onOpenChange(false);
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onOpenChange(false);
			}
		};

		document.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [anchorRef, onOpenChange, open]);

	useEffect(() => {
		if (!open) {
			onPanelHeightChange?.(0);
			return;
		}

		onPanelHeightChange?.(panelRef.current?.offsetHeight ?? 0);

		if (!panelRef.current || !onPanelHeightChange || typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver(() => {
			onPanelHeightChange(panelRef.current?.offsetHeight ?? 0);
		});
		observer.observe(panelRef.current);

		return () => {
			observer.disconnect();
			onPanelHeightChange(0);
		};
	}, [onPanelHeightChange, open]);

	if (!open) {
		return null;
	}

	if (renderMode === "inline") {
		return (
			<div
				ref={panelRef}
				role="dialog"
				aria-label={t("project.savedProjects", "Dự án đã lưu")}
				className="w-full flex flex-col pointer-events-auto select-none"
			>
				<div className="flex items-center justify-between px-2 py-1.5 mb-1.5 border-b border-white/10">
					<div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
						<FolderOpenIcon size={14} className="text-purple-400" />
						<span>{t("project.savedProjects", "Dự án đã lưu")}</span>
					</div>
					{visibleEntries.length > 0 && (
						<span className="text-[10px] font-medium text-white/50 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10">
							{visibleEntries.length}
						</span>
					)}
				</div>
				<div className="max-h-[350px] overflow-y-auto px-1 py-1">
					{visibleEntries.length > 0 ? (
						<div className="grid grid-cols-2 gap-2">
							{visibleEntries.map((entry) => {
								const thumbnailSrc = entry.thumbnailPath
									? toFileUrl(entry.thumbnailPath)
									: entry.isCurrent && currentThumbnailUrl
										? currentThumbnailUrl
										: null;
								const isAutoName =
									/^recording(-\d+)?$/i.test(entry.name) || entry.name === "recording";
								const displayName = isAutoName
									? entry.isCurrent
										? "Record Auto-Zoom"
										: new Date(entry.updatedAt).toLocaleDateString("vi-VN", {
												month: "numeric",
												day: "numeric",
											})
									: entry.name;
								const formattedTime = new Date(entry.updatedAt).toLocaleTimeString("vi-VN", {
									hour: "2-digit",
									minute: "2-digit",
								});
								return (
									<button
										key={entry.path}
										type="button"
										onClick={() => onOpenProject(entry.path)}
										className="group relative flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 text-left outline-none transition-all duration-150 hover:border-purple-400/50 hover:bg-white/[0.08] hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] active:scale-[0.98]"
									>
										<div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-black/40 shadow-inner">
											<ProjectThumbnail
												thumbnailSrc={thumbnailSrc}
												videoPath={entry.videoPath}
												loadingText={t("project.loadingPreview", "Đang tải xem trước...")}
												noPreviewText={t("project.noPreview", "Chưa có xem trước")}
											/>
											{entry.isCurrent ? (
												<div className="absolute right-1 top-1">
													<span className="rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-md">
														{t("project.currentProject", "Hiện tại")}
													</span>
												</div>
											) : null}
										</div>
										<div className="flex flex-1 flex-col px-0.5 min-w-0">
											<div className="truncate text-[11px] font-semibold tracking-tight text-white/90 group-hover:text-white transition-colors">
												{displayName}
											</div>
											<div className="text-[9px] text-white/40 truncate">
												{formattedTime}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center">
							<FolderOpenIcon size={24} className="text-white/30" />
							<div className="text-xs font-medium text-white/70">
								{t("project.noSavedProjects", "Chưa có dự án nào")}
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="pointer-events-none fixed inset-0 z-[90]">
			<div
				ref={panelRef}
				role="dialog"
				aria-label={t("project.savedProjects", "Dự án đã lưu")}
				style={{ top: `${position.top}px`, left: `${position.left}px` }}
				className="pointer-events-auto fixed w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#120822]/95 backdrop-blur-2xl text-slate-900 dark:text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] animate-in fade-in-0 duration-150"
			>
				<div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 px-3 py-2.5">
					<div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white/90">
						<FolderOpenIcon size={14} className="text-purple-500 dark:text-purple-400" />
						<span>{t("project.savedProjects", "Dự án đã lưu")}</span>
					</div>
					{visibleEntries.length > 0 && (
						<span className="text-[10px] font-medium text-slate-500 dark:text-white/40 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
							{visibleEntries.length}
						</span>
					)}
				</div>
				<div
					className="overflow-y-auto px-2 py-2"
					style={{ maxHeight: `${position.maxHeight}px` }}
				>
					{visibleEntries.length > 0 ? (
						<div className="grid grid-cols-2 gap-2">
							{visibleEntries.map((entry) => {
								const thumbnailSrc = entry.thumbnailPath
									? toFileUrl(entry.thumbnailPath)
									: entry.isCurrent && currentThumbnailUrl
										? currentThumbnailUrl
										: null;
								const isAutoName =
									/^recording(-\d+)?$/i.test(entry.name) || entry.name === "recording";
								const displayName = isAutoName
									? entry.isCurrent
										? "Record Auto-Zoom"
										: new Date(entry.updatedAt).toLocaleDateString("vi-VN", {
												month: "numeric",
												day: "numeric",
											})
									: entry.name;
								const formattedTime = new Date(entry.updatedAt).toLocaleTimeString("vi-VN", {
									hour: "2-digit",
									minute: "2-digit",
								});
								return (
									<button
										key={entry.path}
										type="button"
										onClick={() => onOpenProject(entry.path)}
										className="group relative flex flex-col gap-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.04] p-1.5 text-left outline-none transition-all duration-150 hover:border-purple-400/50 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] active:scale-[0.98]"
									>
										<div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-slate-200 dark:bg-black/40 shadow-inner">
											<ProjectThumbnail
												thumbnailSrc={thumbnailSrc}
												videoPath={entry.videoPath}
												loadingText={t("project.loadingPreview", "Đang tải xem trước...")}
												noPreviewText={t("project.noPreview", "Chưa có xem trước")}
											/>
											{entry.isCurrent ? (
												<div className="absolute right-1 top-1">
													<span className="rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-md">
														{t("project.currentProject", "Hiện tại")}
													</span>
												</div>
											) : null}
										</div>
										<div className="flex flex-1 flex-col px-0.5 min-w-0">
											<div className="truncate text-[11px] font-semibold tracking-tight text-slate-800 dark:text-white/90 group-hover:text-purple-600 dark:group-hover:text-white transition-colors">
												{displayName}
											</div>
											<div className="text-[9px] text-slate-400 dark:text-white/40 truncate">
												{formattedTime}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-white/15 bg-slate-50/50 dark:bg-white/[0.02] p-4 text-center">
							<FolderOpenIcon size={24} className="text-slate-400 dark:text-white/30" />
							<div className="text-xs font-medium text-slate-600 dark:text-white/70">
								{t("project.noSavedProjects", "Chưa có dự án nào")}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
