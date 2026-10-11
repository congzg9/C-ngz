import {
	AlignCenterHorizontal as AlignCenter,
	AlignLeft,
	AlignRight,
	TextB as Bold,
	CaretDown as ChevronDown,
	Check,
	ImageSquare as ImageIcon,
	Info,
	TextItalic as Italic,
	MagnifyingGlass,
	Plus,
	BoundingBox as SquareDashed,
	Trash as Trash2,
	TextT as Type,
	TextUnderline as Underline,
	UploadSimple as Upload,
} from "@phosphor-icons/react";
import Block from "@uiw/react-color-block";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getSystemFonts } from "@/lib/systemFonts";
import { cn } from "@/lib/utils";
import { useScopedT } from "../../contexts/I18nContext";
import { getArrowComponent } from "./ArrowSvgs";
import type { AnnotationRegion, AnnotationType, ArrowDirection, FigureData } from "./types";

interface AnnotationSettingsPanelProps {
	annotation: AnnotationRegion;
	annotationRegions?: AnnotationRegion[];
	onSelectAnnotation?: (id: string | null) => void;
	onAddAnnotation?: () => void;
	onSizeChange?: (size: { width: number; height: number }) => void;
	onContentChange: (content: string) => void;
	onTypeChange: (type: AnnotationType) => void;
	onStyleChange: (style: Partial<AnnotationRegion["style"]>) => void;
	onFigureDataChange?: (figureData: FigureData) => void;
	onBlurIntensityChange?: (intensity: number) => void;
	onBlurColorChange?: (color: string) => void;
	onDelete: () => void;
}

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128];

export function AnnotationSettingsPanel({
	annotation,
	annotationRegions,
	onSelectAnnotation,
	onAddAnnotation,
	onSizeChange,
	onContentChange,
	onTypeChange,
	onStyleChange,
	onFigureDataChange,
	onBlurIntensityChange,
	onBlurColorChange,
	onDelete,
}: AnnotationSettingsPanelProps) {
	const t = useScopedT("editor");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [systemFonts, setSystemFonts] = useState<string[]>([]);
	const [fontSearch, setFontSearch] = useState("");
	const [isFontPopoverOpen, setIsFontPopoverOpen] = useState(false);

	// Load system fonts installed on the computer
	useEffect(() => {
		let isCancelled = false;
		void (async () => {
			const fonts = await getSystemFonts();
			if (!isCancelled) {
				setSystemFonts(fonts);
			}
		})();
		return () => {
			isCancelled = true;
		};
	}, []);

	// Filtered system fonts based on search
	const filteredFonts = useMemo(() => {
		if (!fontSearch.trim()) return systemFonts;
		const query = fontSearch.trim().toLowerCase();
		return systemFonts.filter((f) => f.toLowerCase().includes(query));
	}, [systemFonts, fontSearch]);

	// Resolved font name to display
	const currentFontFamily = useMemo(() => {
		const raw = annotation.style.fontFamily || "";
		// Extract clean font name if font is comma-separated or quoted
		const first = raw.split(",")[0].replace(/['"]/g, "").trim();
		return first || "Arial";
	}, [annotation.style.fontFamily]);

	const colorPalette = [
		"#FF0000", // Red
		"#FFD700", // Yellow/Gold
		"#00FF00", // Green
		"#FFFFFF", // White
		"#0000FF", // Blue
		"#FF6B00", // Orange
		"#9B59B6", // Purple
		"#E91E63", // Pink
		"#00BCD4", // Cyan
		"#FF5722", // Deep Orange
		"#8BC34A", // Light Green
		"#FFC107", // Amber
		"#2563EB", // Brand Blue
		"#000000", // Black
		"#607D8B", // Blue Grey
		"#795548", // Brown
	];

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
		if (!validTypes.includes(file.type)) {
			toast.error(t("annotations.imageUploadError", "Lỗi tải ảnh"), {
				description: t("annotations.imageUploadErrorDescription", "Định dạng ảnh không được hỗ trợ"),
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (dataUrl) {
				const img = new Image();
				img.onload = () => {
					onContentChange(dataUrl);
					if (onSizeChange && img.naturalWidth && img.naturalHeight) {
						const aspect = img.naturalWidth / img.naturalHeight;
						let w = 40;
						let h = w / aspect;
						if (h > 60) {
							h = 60;
							w = h * aspect;
						}
						if (w > 80) {
							w = 80;
							h = w / aspect;
						}
						onSizeChange({
							width: Math.max(5, Math.min(100, Math.round(w))),
							height: Math.max(5, Math.min(100, Math.round(h))),
						});
					}
					toast.success(t("annotations.imageUploadSuccess", "Tải ảnh thành công"));
				};
				img.src = dataUrl;
			}
		};

		reader.onerror = () => {
			toast.error(t("annotations.imageUploadFailed", "Không thể đọc file ảnh"), {
				description: t("annotations.imageUploadFailedDescription", "Vui lòng thử lại với ảnh khác"),
			});
		};

		reader.readAsDataURL(file);
		event.target.value = "";
	};

	return (
		<div className="flex-[2] w-[332px] min-w-[280px] max-w-[332px] flex-shrink-0 bg-editor-panel border border-foreground/10 rounded-2xl flex flex-col shadow-xl h-full overflow-hidden">
			<div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
				<div className="mb-4">
					{/* Header consistent with Recordly design */}
					<div className="flex items-center justify-between mb-3.5">
						<div className="flex items-center gap-1.5">
							<Type className="h-4 w-4 text-violet-500" weight="duotone" />
							<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
								{t("annotations.settings", "Cài đặt Chú thích")}
							</span>
						</div>
						<div className="flex items-center gap-1.5">
							{onAddAnnotation && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={onAddAnnotation}
									className="h-6 px-2 text-[10px] font-medium gap-1 rounded-lg border border-dashed border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5 hover:bg-violet-500/10 text-violet-500 transition-all cursor-pointer"
									title="Thêm chú thích mới"
								>
									<Plus className="w-3 h-3" weight="bold" />
									<span>{t("common.actions.addNew", "Thêm mới")}</span>
								</Button>
							)}
						</div>
					</div>

					{/* Region pills if multiple annotations exist */}
					{annotationRegions && annotationRegions.length > 1 && (
						<div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-3 custom-scrollbar">
							{annotationRegions.map((region, idx) => {
								const isCurrent = region.id === annotation.id;
								const label = region.textContent || region.content || `${region.type} #${idx + 1}`;
								return (
									<button
										key={region.id}
										type="button"
										onClick={() => onSelectAnnotation?.(region.id)}
										className={cn(
											"flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all max-w-[110px] truncate cursor-pointer",
											isCurrent
												? "bg-violet-500/15 text-violet-500 border border-violet-500/30 shadow-sm"
												: "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground border border-transparent",
										)}
									>
										{label}
									</button>
								);
							})}
						</div>
					)}

					{/* Type Selector Tabs */}
					<Tabs
						value={annotation.type}
						onValueChange={(value) => onTypeChange(value as AnnotationType)}
						className="mb-4"
					>
						<TabsList className="mb-4 bg-foreground/[0.04] border border-foreground/[0.08] p-1 w-full grid grid-cols-4 h-9 rounded-xl">
							<TabsTrigger
								value="text"
								className="data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-500 data-[state=active]:border-violet-500/30 data-[state=active]:font-semibold border border-transparent text-muted-foreground py-1 text-xs rounded-lg transition-all gap-1.5"
							>
								<Type className="w-3.5 h-3.5" weight="bold" />
								<span>{t("annotations.text", "Văn bản")}</span>
							</TabsTrigger>
							<TabsTrigger
								value="image"
								className="data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-500 data-[state=active]:border-violet-500/30 data-[state=active]:font-semibold border border-transparent text-muted-foreground py-1 text-xs rounded-lg transition-all gap-1.5"
							>
								<ImageIcon className="w-3.5 h-3.5" weight="bold" />
								<span>{t("annotations.image", "Hình ảnh")}</span>
							</TabsTrigger>
							<TabsTrigger
								value="figure"
								className="data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-500 data-[state=active]:border-violet-500/30 data-[state=active]:font-semibold border border-transparent text-muted-foreground py-1 text-xs rounded-lg transition-all gap-1.5"
							>
								<svg
									className="w-3.5 h-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
								>
									<path
										d="M4 12h16m0 0l-6-6m6 6l-6 6"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								<span>{t("annotations.arrow", "Mũi tên")}</span>
							</TabsTrigger>
							<TabsTrigger
								value="blur"
								className="data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-500 data-[state=active]:border-violet-500/30 data-[state=active]:font-semibold border border-transparent text-muted-foreground py-1 text-xs rounded-lg transition-all gap-1.5"
							>
								<SquareDashed className="w-3.5 h-3.5" weight="bold" />
								<span>{t("annotations.blur", "Làm mờ")}</span>
							</TabsTrigger>
						</TabsList>

						{/* Text Content */}
						<TabsContent value="text" className="mt-0 space-y-4">
							<div className="flex flex-col gap-1.5">
								<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
									{t("annotations.textContent", "Nội dung văn bản")}
								</label>
								<textarea
									value={annotation.textContent || annotation.content}
									onChange={(e) => onContentChange(e.target.value)}
									placeholder={t("annotations.textPlaceholder", "Nhập nội dung văn bản...")}
									rows={4}
									className="w-full px-3 py-2.5 bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 resize-none transition-all leading-relaxed"
								/>
							</div>

							{/* Styling Controls */}
							<div className="flex flex-col gap-3.5">
								{/* System Font Family Picker & Font Size */}
								<div className="grid grid-cols-2 gap-2">
									{/* Computer System Fonts Dropdown */}
									<div className="flex flex-col gap-1.5">
										<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											{t("annotations.fontStyle", "Phông chữ")}
										</label>

										<Popover open={isFontPopoverOpen} onOpenChange={setIsFontPopoverOpen}>
											<PopoverTrigger asChild>
												<button
													type="button"
													className="w-full h-9 px-2.5 bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-foreground/[0.08] hover:border-foreground/15 rounded-xl text-foreground text-xs flex items-center justify-between gap-1.5 transition-all text-left outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
													title={currentFontFamily}
												>
													<span
														className="truncate flex-1 font-medium"
														style={{ fontFamily: currentFontFamily }}
													>
														{currentFontFamily}
													</span>
													<ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
												</button>
											</PopoverTrigger>
											<PopoverContent
												className="w-[240px] p-2 bg-editor-panel border border-foreground/10 rounded-xl shadow-2xl z-50"
												align="start"
											>
												<div className="flex flex-col gap-1.5">
													{/* Search input for system fonts */}
													<div className="relative flex items-center px-2 py-1 bg-foreground/[0.04] border border-foreground/[0.08] rounded-lg">
														<MagnifyingGlass className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mr-1.5" />
														<input
															type="text"
															value={fontSearch}
															onChange={(e) => setFontSearch(e.target.value)}
															placeholder="Tìm phông chữ máy tính..."
															className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
														/>
													</div>

													<div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-1">
														Phông chữ trên máy ({filteredFonts.length})
													</div>

													<div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 pr-0.5">
														{filteredFonts.length === 0 ? (
															<div className="px-2 py-3 text-center text-xs text-muted-foreground">
																Không tìm thấy phông chữ
															</div>
														) : (
															filteredFonts.map((fontName) => {
																const isSelected =
																	currentFontFamily.toLowerCase() ===
																	fontName.toLowerCase();
																return (
																	<button
																		key={fontName}
																		type="button"
																		onClick={() => {
																			onStyleChange({
																				fontFamily: `"${fontName}", sans-serif`,
																			});
																			setIsFontPopoverOpen(false);
																		}}
																		className={cn(
																			"w-full px-2.5 py-1.5 text-left text-xs rounded-lg transition-all flex items-center justify-between gap-2 cursor-pointer",
																			isSelected
																				? "bg-violet-500/15 text-violet-500 font-medium"
																				: "text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground",
																		)}
																	>
																		<span
																			className="truncate"
																			style={{ fontFamily: `"${fontName}", sans-serif` }}
																		>
																			{fontName}
																		</span>
																		{isSelected && (
																			<Check className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" weight="bold" />
																		)}
																	</button>
																);
															})
														)}
													</div>
												</div>
											</PopoverContent>
										</Popover>
									</div>

									{/* Font Size */}
									<div className="flex flex-col gap-1.5">
										<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											{t("annotations.size", "Kích thước")}
										</label>
										<Select
											value={annotation.style.fontSize.toString()}
											onValueChange={(value) =>
												onStyleChange({ fontSize: parseInt(value) })
											}
										>
											<SelectTrigger className="w-full bg-foreground/[0.03] hover:bg-foreground/[0.06] border-foreground/[0.08] text-foreground h-9 text-xs rounded-xl transition-all">
												<SelectValue placeholder={t("annotations.size", "Kích thước")} />
											</SelectTrigger>
											<SelectContent className="bg-editor-panel border-foreground/10 text-foreground max-h-[220px] rounded-xl">
												{FONT_SIZES.map((size) => (
													<SelectItem key={size} value={size.toString()} className="text-xs">
														{size}px
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								{/* Formatting Toggles */}
								<div className="flex items-center justify-between gap-2">
									<ToggleGroup
										type="multiple"
										className="justify-start bg-foreground/[0.04] p-1 rounded-xl border border-foreground/[0.08] gap-0.5"
									>
										<ToggleGroupItem
											value="bold"
											aria-label={t("annotations.toggleBold", "In đậm")}
											data-state={
												annotation.style.fontWeight === "bold"
													? "on"
													: "off"
											}
											onClick={() =>
												onStyleChange({
													fontWeight:
														annotation.style.fontWeight === "bold"
															? "normal"
															: "bold",
												})
											}
											className="h-8 w-8 rounded-lg data-[state=on]:bg-violet-500/20 data-[state=on]:text-violet-500 data-[state=on]:border-violet-500/30 border border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
										>
											<Bold className="h-4 w-4" weight="bold" />
										</ToggleGroupItem>
										<ToggleGroupItem
											value="italic"
											aria-label={t("annotations.toggleItalic", "In nghiêng")}
											data-state={
												annotation.style.fontStyle === "italic"
													? "on"
													: "off"
											}
											onClick={() =>
												onStyleChange({
													fontStyle:
														annotation.style.fontStyle === "italic"
															? "normal"
															: "italic",
												})
											}
											className="h-8 w-8 rounded-lg data-[state=on]:bg-violet-500/20 data-[state=on]:text-violet-500 data-[state=on]:border-violet-500/30 border border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
										>
											<Italic className="h-4 w-4" weight="bold" />
										</ToggleGroupItem>
										<ToggleGroupItem
											value="underline"
											aria-label={t("annotations.toggleUnderline", "Gạch chân")}
											data-state={
												annotation.style.textDecoration === "underline"
													? "on"
													: "off"
											}
											onClick={() =>
												onStyleChange({
													textDecoration:
														annotation.style.textDecoration ===
														"underline"
															? "none"
															: "underline",
												})
											}
											className="h-8 w-8 rounded-lg data-[state=on]:bg-violet-500/20 data-[state=on]:text-violet-500 data-[state=on]:border-violet-500/30 border border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
										>
											<Underline className="h-4 w-4" weight="bold" />
										</ToggleGroupItem>
									</ToggleGroup>

									<ToggleGroup
										type="single"
										value={annotation.style.textAlign}
										className="justify-start bg-foreground/[0.04] p-1 rounded-xl border border-foreground/[0.08] gap-0.5"
									>
										<ToggleGroupItem
											value="left"
											aria-label={t("annotations.alignLeft", "Căn trái")}
											onClick={() => onStyleChange({ textAlign: "left" })}
											className="h-8 w-8 rounded-lg data-[state=on]:bg-violet-500/20 data-[state=on]:text-violet-500 data-[state=on]:border-violet-500/30 border border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
										>
											<AlignLeft className="h-4 w-4" weight="bold" />
										</ToggleGroupItem>
										<ToggleGroupItem
											value="center"
											aria-label={t("annotations.alignCenter", "Căn giữa")}
											onClick={() => onStyleChange({ textAlign: "center" })}
											className="h-8 w-8 rounded-lg data-[state=on]:bg-violet-500/20 data-[state=on]:text-violet-500 data-[state=on]:border-violet-500/30 border border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
										>
											<AlignCenter className="h-4 w-4" weight="bold" />
										</ToggleGroupItem>
										<ToggleGroupItem
											value="right"
											aria-label={t("annotations.alignRight", "Căn phải")}
											onClick={() => onStyleChange({ textAlign: "right" })}
											className="h-8 w-8 rounded-lg data-[state=on]:bg-violet-500/20 data-[state=on]:text-violet-500 data-[state=on]:border-violet-500/30 border border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
										>
											<AlignRight className="h-4 w-4" weight="bold" />
										</ToggleGroupItem>
									</ToggleGroup>
								</div>

								{/* Colors */}
								<div className="grid grid-cols-2 gap-3">
									<div className="flex flex-col gap-1.5">
										<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											{t("annotations.textColor", "Màu chữ")}
										</label>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="w-full h-9 justify-start gap-2 bg-foreground/[0.03] hover:bg-foreground/[0.06] border-foreground/[0.08] px-2.5 rounded-xl"
												>
													<div
														className="w-4 h-4 rounded-full border border-foreground/20 shadow-sm"
														style={{
															backgroundColor: annotation.style.color,
														}}
													/>
													<span className="text-xs text-muted-foreground truncate flex-1 text-left font-mono">
														{annotation.style.color}
													</span>
													<ChevronDown className="h-3 w-3 opacity-50" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-[260px] p-3 bg-editor-panel border border-foreground/10 rounded-xl shadow-xl">
												<Block
													color={annotation.style.color}
													colors={colorPalette}
													onChange={(color) => {
														onStyleChange({ color: color.hex });
													}}
													style={{
														borderRadius: "8px",
													}}
												/>
											</PopoverContent>
										</Popover>
									</div>

									<div className="flex flex-col gap-1.5">
										<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											{t("annotations.background", "Nền chữ")}
										</label>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="w-full h-9 justify-start gap-2 bg-foreground/[0.03] hover:bg-foreground/[0.06] border-foreground/[0.08] px-2.5 rounded-xl"
												>
													<div className="w-4 h-4 rounded-full border border-foreground/20 relative overflow-hidden shadow-sm">
														<div className="absolute inset-0 checkerboard-bg opacity-50" />
														<div
															className="absolute inset-0"
															style={{
																backgroundColor:
																	annotation.style
																		.backgroundColor,
															}}
														/>
													</div>
													<span className="text-xs text-muted-foreground truncate flex-1 text-left">
														{annotation.style.backgroundColor ===
														"transparent"
															? t("annotations.none", "Không có")
															: annotation.style.backgroundColor}
													</span>
													<ChevronDown className="h-3 w-3 opacity-50" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-[260px] p-3 bg-editor-panel border border-foreground/10 rounded-xl shadow-xl">
												<Block
													color={
														annotation.style.backgroundColor ===
														"transparent"
															? "#000000"
															: annotation.style.backgroundColor
													}
													colors={colorPalette}
													onChange={(color) => {
														onStyleChange({
															backgroundColor: color.hex,
														});
													}}
													style={{
														borderRadius: "8px",
													}}
												/>
												<Button
													variant="ghost"
													size="sm"
													className="w-full mt-2 text-xs h-7 hover:bg-foreground/5 text-muted-foreground rounded-lg"
													onClick={() => {
														onStyleChange({
															backgroundColor: "transparent",
														});
													}}
												>
													{t("annotations.clearBackground", "Xóa màu nền")}
												</Button>
											</PopoverContent>
										</Popover>
									</div>
								</div>
							</div>
						</TabsContent>

						{/* Image Upload */}
						<TabsContent value="image" className="mt-0 space-y-4">
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleImageUpload}
								accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
								className="hidden"
							/>
							{annotation.content && annotation.content.startsWith("data:image") ? (
								<div className="space-y-3">
									<div className="relative rounded-xl border border-foreground/10 overflow-hidden bg-foreground/[0.03] p-2 max-h-48 flex items-center justify-center">
										<img
											src={annotation.content}
											alt="Uploaded annotation"
											className="max-h-44 max-w-full object-contain rounded-lg shadow-sm"
										/>
									</div>
									<Button
										onClick={() => fileInputRef.current?.click()}
										variant="outline"
										size="sm"
										className="w-full gap-2 text-xs h-8 border-foreground/15 hover:bg-foreground/5 rounded-xl cursor-pointer"
									>
										<Upload className="w-3.5 h-3.5" />
										<span>{t("annotations.replaceImage", "Thay đổi ảnh")}</span>
									</Button>
								</div>
							) : (
								<Button
									onClick={() => fileInputRef.current?.click()}
									variant="outline"
									className="w-full gap-2 bg-foreground/[0.03] text-foreground border-dashed border-foreground/15 hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-violet-500 transition-all py-8 rounded-xl cursor-pointer"
								>
									<Upload className="w-5 h-5" />
									<span>{t("annotations.uploadImage", "Tải ảnh lên")}</span>
								</Button>
							)}

							{/* Size Controls */}
							{onSizeChange && (
								<div className="space-y-3 pt-2 border-t border-foreground/10">
									<div className="space-y-1.5">
										<div className="flex items-center justify-between text-xs">
											<span className="text-muted-foreground">{t("annotations.width", "Chiều rộng")}</span>
											<span className="font-mono text-[11px] text-foreground">{Math.round(annotation.size.width)}%</span>
										</div>
										<Slider
											value={[annotation.size.width]}
											min={5}
											max={100}
											step={1}
											onValueChange={([val]) => {
												onSizeChange({
													width: val,
													height: annotation.size.height,
												});
											}}
										/>
									</div>
									<div className="space-y-1.5">
										<div className="flex items-center justify-between text-xs">
											<span className="text-muted-foreground">{t("annotations.height", "Chiều cao")}</span>
											<span className="font-mono text-[11px] text-foreground">{Math.round(annotation.size.height)}%</span>
										</div>
										<Slider
											value={[annotation.size.height]}
											min={5}
											max={100}
											step={1}
											onValueChange={([val]) => {
												onSizeChange({
													width: annotation.size.width,
													height: val,
												});
											}}
										/>
									</div>
								</div>
							)}

							<p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
								{t("annotations.supportedFormats", "Hỗ trợ PNG, JPG, GIF, WebP")}
							</p>
						</TabsContent>

						{/* Figure / Arrow */}
						<TabsContent value="figure" className="mt-0 space-y-4">
							<div>
								<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 block">
									{t("annotations.arrowDirection", "Hướng mũi tên")}
								</label>
								<div className="grid grid-cols-4 gap-2">
									{(
										[
											"up",
											"down",
											"left",
											"right",
											"up-right",
											"up-left",
											"down-right",
											"down-left",
										] as ArrowDirection[]
									).map((direction) => {
										const ArrowComponent = getArrowComponent(direction);
										const isSelected = annotation.figureData?.arrowDirection === direction;
										return (
											<button
												key={direction}
												type="button"
												onClick={() => {
													const newFigureData: FigureData = {
														...annotation.figureData!,
														arrowDirection: direction,
													};
													onFigureDataChange?.(newFigureData);
												}}
												aria-label={t(
													"annotations.arrowDirectionOption",
													"Arrow direction: {{direction}}",
													{ direction: direction.replace(/-/g, " ") },
												)}
												className={cn(
													"h-14 rounded-xl border flex items-center justify-center transition-all p-2 cursor-pointer",
													isSelected
														? "bg-violet-500/15 border-violet-500/40 text-violet-500 shadow-sm"
														: "bg-foreground/[0.03] border-foreground/[0.08] hover:bg-foreground/[0.06] hover:border-foreground/15 text-muted-foreground",
												)}
											>
												<ArrowComponent
													color={isSelected ? "#f59e0b" : "currentColor"}
													strokeWidth={2.5}
												/>
											</button>
										);
									})}
								</div>
							</div>

							<div>
								<div className="flex items-center justify-between text-xs mb-1.5">
									<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										{t("annotations.strokeWidth", "Độ dày nét")}
									</span>
									<span className="font-mono text-[11px] text-foreground">
										{annotation.figureData?.strokeWidth || 4}px
									</span>
								</div>
								<Slider
									value={[annotation.figureData?.strokeWidth || 4]}
									onValueChange={([value]) => {
										const newFigureData: FigureData = {
											...annotation.figureData!,
											strokeWidth: value,
										};
										onFigureDataChange?.(newFigureData);
									}}
									min={1}
									max={8}
									step={1}
									className="w-full"
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
									{t("annotations.arrowColor", "Màu mũi tên")}
								</label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full h-9 justify-start gap-2 bg-foreground/[0.03] hover:bg-foreground/[0.06] border-foreground/[0.08] px-2.5 rounded-xl"
										>
											<div
												className="w-4 h-4 rounded-full border border-foreground/20 shadow-sm"
												style={{
													backgroundColor:
														annotation.figureData?.color || "#f59e0b",
												}}
											/>
											<span className="text-xs text-muted-foreground truncate flex-1 text-left font-mono">
												{annotation.figureData?.color || "#f59e0b"}
											</span>
											<ChevronDown className="h-3 w-3 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[260px] p-3 bg-editor-panel border border-foreground/10 rounded-xl shadow-xl">
										<Block
											color={annotation.figureData?.color || "#f59e0b"}
											colors={colorPalette}
											onChange={(color) => {
												const newFigureData: FigureData = {
													...annotation.figureData!,
													color: color.hex,
												};
												onFigureDataChange?.(newFigureData);
											}}
											style={{
												borderRadius: "8px",
											}}
										/>
									</PopoverContent>
								</Popover>
							</div>
						</TabsContent>

						{/* Blur Tab */}
						<TabsContent value="blur" className="mt-0 space-y-4">
							<div className="p-3.5 bg-foreground/[0.03] rounded-xl border border-foreground/[0.08] flex flex-col gap-3">
								<div className="w-full space-y-2">
									<div className="flex items-center justify-between text-xs">
										<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											{t("annotations.blurLabel", "Độ mờ")}
										</span>
										<span className="font-mono text-[11px] text-foreground">
											{annotation.blurIntensity ?? 20}%
										</span>
									</div>
									<Slider
										value={[annotation.blurIntensity ?? 20]}
										onValueChange={([value]) => onBlurIntensityChange?.(value)}
										min={1}
										max={100}
										step={1}
										className="w-full"
									/>
								</div>

								<div className="w-full space-y-2 pt-2 border-t border-foreground/[0.06]">
									<div className="flex items-center justify-between">
										<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											{t(
												"annotations.solidColor",
												"Màu che (Censorship)",
											)}
										</span>
									</div>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											onClick={() => onBlurColorChange?.("")}
											className={cn(
												"w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer",
												!annotation.blurColor ||
													annotation.blurColor === "transparent"
													? "border-violet-500 scale-105"
													: "border-transparent hover:border-foreground/20",
											)}
											title={t("annotations.none", "Không màu")}
										>
											<div className="w-5 h-5 rounded-full bg-foreground/[0.06] flex items-center justify-center overflow-hidden relative">
												<div className="absolute w-full h-0.5 bg-red-500 rotate-45" />
											</div>
										</button>
										<button
											type="button"
											onClick={() => onBlurColorChange?.("#000000")}
											className={cn(
												"w-7 h-7 rounded-full border-2 transition-all bg-black cursor-pointer",
												annotation.blurColor === "#000000"
													? "border-violet-500 scale-105"
													: "border-transparent hover:border-foreground/20",
											)}
											title="Đen"
										/>
										<button
											type="button"
											onClick={() => onBlurColorChange?.("#FFFFFF")}
											className={cn(
												"w-7 h-7 rounded-full border-2 transition-all bg-white cursor-pointer shadow-sm",
												annotation.blurColor === "#FFFFFF"
													? "border-violet-500 scale-105"
													: "border-transparent hover:border-foreground/20",
											)}
											title="Trắng"
										/>

										<Popover>
											<PopoverTrigger asChild>
												<button
													type="button"
													className={cn(
														"w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center overflow-hidden relative cursor-pointer",
														annotation.blurColor &&
															![
																"#000000",
																"#FFFFFF",
																"transparent",
															].includes(annotation.blurColor)
															? "border-violet-500 scale-105"
															: "border-foreground/20 hover:border-foreground/40",
													)}
													style={{
														backgroundColor:
															annotation.blurColor &&
															![
																"#000000",
																"#FFFFFF",
																"transparent",
															].includes(annotation.blurColor)
																? annotation.blurColor
																: undefined,
													}}
													title={t("annotations.customColor", "Màu tùy chỉnh")}
												>
													{(!annotation.blurColor ||
														[
															"#000000",
															"#FFFFFF",
															"transparent",
														].includes(annotation.blurColor)) && (
														<div className="w-full h-full bg-gradient-to-tr from-rose-500 via-emerald-500 to-indigo-500 opacity-80" />
													)}
												</button>
											</PopoverTrigger>
											<PopoverContent className="w-[260px] p-3 bg-editor-panel border border-foreground/10 rounded-xl shadow-xl">
												<Block
													color={annotation.blurColor || "#000000"}
													colors={colorPalette}
													onChange={(color) => {
														onBlurColorChange?.(color.hex);
													}}
													style={{
														borderRadius: "8px",
													}}
												/>
											</PopoverContent>
										</Popover>
									</div>
								</div>
							</div>
						</TabsContent>
					</Tabs>

					{/* Shortcuts / Tips */}
					<div className="mt-4 p-3 bg-foreground/[0.03] rounded-xl border border-foreground/[0.06]">
						<div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
							<Info className="w-3.5 h-3.5 text-violet-500" />
							<span className="text-[10px] font-semibold uppercase tracking-wider">
								{t("annotations.shortcutsAndTips", "Phím tắt & Mẹo")}
							</span>
						</div>
						<ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-3.5 leading-relaxed">
							<li>{t("annotations.tipSelectAnnotation", "Click vào chú thích trên màn hình để di chuyển và đổi kích thước")}</li>
							<li>{t("annotations.tipCycleForward", "Bấm Delete hoặc nút bên dưới để xóa")}</li>
						</ul>
					</div>
				</div>
			</div>

			{/* Delete button consistent with other panels */}
			<div className="flex-shrink-0 border-t border-foreground/10 bg-editor-panel p-4 pt-3">
				<Button
					onClick={onDelete}
					variant="destructive"
					size="sm"
					className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs font-medium text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20 active:scale-[0.99] rounded-xl"
				>
					<Trash2 className="h-3.5 w-3.5" />
					<span>{t("annotations.deleteAnnotation", "Xóa chú thích")}</span>
				</Button>
			</div>
		</div>
	);
}
