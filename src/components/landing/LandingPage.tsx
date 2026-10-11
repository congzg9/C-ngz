import {
	ArrowSquareOut,
	CheckCircle,
	Cpu,
	Cursor,
	DownloadSimple,
	Lightning,
	Monitor,
	PaintBrush,
	Play,
	ShieldCheck,
	Sparkle,
	VideoCamera,
	WindowsLogo,
} from "@phosphor-icons/react";
import { useState } from "react";

const WINDOWS_DOWNLOAD_URL =
	"https://pub-4c232cb201914b09a4118b93c77c37c1.r2.dev/Record-AutoZoom-windows-x64.exe";

interface LandingPageProps {
	onOpenWebEditor: () => void;
}

const CURSOR_PREVIEWS = [
	{ id: "macos", label: "macOS Classic", desc: "Đen tuyền viền trắng sắc nét", tag: "Phổ biến" },
	{ id: "tahoe", label: "Tahoe Crystal", desc: "Viền kính mờ chuyển động mượt", tag: "Mới" },
	{ id: "neon", label: "Cyber Neon", desc: "Tím ánh xanh phát quang nổi bật", tag: "Gaming" },
	{ id: "glow", label: "Sunset Glow", desc: "Vầng sáng cam hoàng hôn ấn tượng", tag: "Hot" },
	{ id: "figma", label: "Figma Minimal", desc: "Tối giản hiện đại cho video dạy học", tag: "Clean" },
	{ id: "tahoe-inverted", label: "Tahoe Inverted", desc: "Kính tương phản cao trên nền tối", tag: "Pro" },
];

const FEATURES = [
	{
		icon: Sparkle,
		title: "Auto-Zoom Theo Chuột Thông Minh",
		desc: "Tự động bắt nét mượt mà theo từng cú click và chuyển động chuột, giúp người xem luôn tập trung vào điểm nhấn của bài thuyết trình hoặc video hướng dẫn.",
		tag: "Độc quyền",
	},
	{
		icon: Cursor,
		title: "8 Bộ Con Trỏ Chuột Cao Cấp",
		desc: "Tùy biến phóng to con trỏ, thêm vầng sáng phát quang, đuôi chuyển động mượt mà (Cursor Sway) như video giới thiệu sản phẩm của Apple.",
		tag: "Mới nâng cấp",
	},
	{
		icon: PaintBrush,
		title: "Hình Nền & Đổ Bóng 3D Tuyệt Đẹp",
		desc: "Bo tròn góc màn hình (Squircle), đổ bóng đa tầng 3D, áp dụng bộ ảnh nền 4K hoặc gradient hoàng hôn giúp video của bạn trông sang trọng vượt bậc.",
		tag: "Chuyên nghiệp",
	},
	{
		icon: Cpu,
		title: "Tăng Tốc Phần Cứng GPU",
		desc: "Tận dụng tối đa sức mạnh NVIDIA CUDA, Direct3D 11 và WebCodecs để ghi hình 60FPS mượt mà và xuất video nhanh hơn gấp 5 lần không hao pin.",
		tag: "Hiệu năng cao",
	},
	{
		icon: VideoCamera,
		title: "Webcam & Thu Âm Kép Tinh Chỉnh",
		desc: "Ghi hình đồng thời webcam bo tròn hoặc toàn màn hình, tách riêng âm thanh máy tính và giọng nói micro với bộ lọc âm trong trẻo.",
		tag: "Đồng bộ",
	},
	{
		icon: ShieldCheck,
		title: "100% Cục Bộ & Bảo Mật Tuyệt Đối",
		desc: "Mọi dữ liệu video đều lưu trực tiếp trên ổ cứng máy bạn, không gửi lên đám mây máy chủ người khác, hỗ trợ Tiếng Việt hoàn chỉnh.",
		tag: "Riêng tư",
	},
];

export default function LandingPage({ onOpenWebEditor }: LandingPageProps) {
	const [activeCursor, setActiveCursor] = useState("glow");

	return (
		<div className="min-h-screen bg-[#0b0413] text-white selection:bg-purple-500 selection:text-white font-sans antialiased overflow-x-hidden">
			{/* Background ambient glow effects */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
				<div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-purple-600/20 via-orange-500/15 to-transparent blur-[140px] rounded-full" />
				<div className="absolute top-[35%] -left-40 w-[600px] h-[600px] bg-purple-700/10 blur-[150px] rounded-full" />
				<div className="absolute top-[50%] -right-40 w-[600px] h-[600px] bg-orange-600/10 blur-[150px] rounded-full" />
				<div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
			</div>

			{/* Sticky Top Navbar */}
			<header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0b0413]/80 border-b border-white/[0.08]">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-[1.5px] shadow-lg shadow-purple-500/25">
							<div className="w-full h-full bg-[#120621] rounded-[10px] flex items-center justify-center overflow-hidden">
								<img src="/app-icon.png" alt="Record Auto-Zoom Logo" className="w-7 h-7 object-contain" />
							</div>
						</div>
						<div className="flex flex-col">
							<div className="flex items-center gap-2">
								<span className="font-bold text-base tracking-tight text-white">Record Auto-Zoom</span>
								<span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-500/20 to-orange-500/20 border border-purple-400/30 text-purple-200">
									v1.3 Pro
								</span>
							</div>
							<span className="text-[11px] text-white/50 -mt-0.5">Screen Recorder & Auto-Zoom Studio</span>
						</div>
					</div>

					<nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/70">
						<a href="#features" className="hover:text-white transition-colors">Tính năng</a>
						<a href="#cursors" className="hover:text-white transition-colors">Con trỏ chuột</a>
						<a href="#download" className="hover:text-white transition-colors">Tải về</a>
						<button
							type="button"
							onClick={onOpenWebEditor}
							className="hover:text-purple-300 transition-colors flex items-center gap-1.5"
						>
							<span>Trình biên tập Web</span>
							<ArrowSquareOut size={13} className="text-purple-400" />
						</button>
					</nav>

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={onOpenWebEditor}
							className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all active:scale-95"
						>
							<span>Dùng bản Web</span>
						</button>
						<a
							href={WINDOWS_DOWNLOAD_URL}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-500/30 transition-all duration-150 active:scale-95"
						>
							<DownloadSimple size={15} weight="bold" />
							<span>Tải cho Windows</span>
						</a>
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<section className="relative z-10 pt-16 pb-20 px-4 sm:px-6 text-center">
				<div className="max-w-4xl mx-auto">
					{/* Eyebrow Pill */}
					<div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-medium text-purple-200/90 shadow-inner mb-6 animate-pulse">
						<span className="flex h-2 w-2 rounded-full bg-orange-400" />
						<span>Bản phát hành chính thức 1.3.0 • Hỗ trợ Windows 10 & 11 (64-bit)</span>
					</div>

					{/* Main Title */}
					<h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
						Quay Màn Hình &{" "}
						<span className="bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
							Tự Động Zoom
						</span>{" "}
						Cực Đỉnh
					</h1>

					{/* Subtitle */}
					<p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed mb-10">
						Tạo video bài giảng, giới thiệu phần mềm và demo đỉnh cao như quảng cáo của Apple.
						Tự động lia camera và phóng to con trỏ chuột mượt mà, hỗ trợ 8 kiểu con trỏ độc quyền cùng giao diện Tiếng Việt 100%.
					</p>

					{/* Call To Action Buttons */}
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
						<a
							href={WINDOWS_DOWNLOAD_URL}
							className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 shadow-[0_12px_40px_rgba(249,115,22,0.4)] transition-all duration-200 active:scale-[0.98] group"
						>
							<WindowsLogo size={22} weight="fill" className="text-white group-hover:scale-110 transition-transform" />
							<div className="flex flex-col text-left">
								<span className="leading-tight">Tải về cho Windows (64-bit)</span>
								<span className="text-[11px] font-normal text-white/80">Bộ cài đặt chính thức • Dung lượng 358 MB</span>
							</div>
							<DownloadSimple size={20} weight="bold" className="ml-1" />
						</a>

						<button
							type="button"
							onClick={onOpenWebEditor}
							className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-semibold text-white/90 bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 backdrop-blur-xl transition-all duration-200 active:scale-[0.98]"
						>
							<Play size={18} weight="fill" className="text-purple-400" />
							<span>Mở Web Editor (Dùng thử ngay)</span>
						</button>
					</div>

					{/* Trust Badges */}
					<div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/50 pt-2">
						<span className="flex items-center gap-1.5">
							<CheckCircle size={15} weight="fill" className="text-emerald-400" /> Miễn phí 100%
						</span>
						<span className="flex items-center gap-1.5">
							<CheckCircle size={15} weight="fill" className="text-emerald-400" /> Tải trực tiếp siêu tốc qua Cloudflare R2
						</span>
						<span className="flex items-center gap-1.5">
							<CheckCircle size={15} weight="fill" className="text-emerald-400" /> Không dính watermark
						</span>
						<span className="flex items-center gap-1.5">
							<CheckCircle size={15} weight="fill" className="text-emerald-400" /> Không cần tài khoản
						</span>
					</div>
				</div>

				{/* Visual Showcase (Interactive Mockup of Record Auto-Zoom) */}
				<div className="max-w-5xl mx-auto mt-14">
					<div className="relative rounded-3xl p-2.5 sm:p-4 bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_30px_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
						{/* Window Header */}
						<div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-3 text-xs text-white/60">
							<div className="flex items-center gap-2">
								<span className="w-3 h-3 rounded-full bg-rose-500/80" />
								<span className="w-3 h-3 rounded-full bg-amber-500/80" />
								<span className="w-3 h-3 rounded-full bg-emerald-500/80" />
								<span className="ml-2 font-medium text-white/80">Record Auto-Zoom Studio — Preview Demo</span>
							</div>
							<div className="flex items-center gap-2 text-[11px] bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full">
								<span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
								<span>Auto-Zoom Active (2.5x)</span>
							</div>
						</div>

						{/* Mockup Canvas */}
						<div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#1d0833] via-[#0f041d] to-[#080210] flex items-center justify-center border border-white/10 shadow-inner group">
							{/* Background Wallpaper */}
							<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-transparent to-black/80" />

							{/* Simulated Screen with Squircle and Shadow */}
							<div className="relative w-[85%] h-[80%] rounded-xl bg-slate-900 border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col scale-[1.03] transition-transform duration-500">
								{/* Top bar of recorded window */}
								<div className="h-7 bg-slate-800/90 border-b border-white/10 flex items-center justify-between px-3 text-[10px] text-white/50">
									<div className="flex items-center gap-1.5">
										<span className="w-2 h-2 rounded-full bg-white/20" />
										<span className="w-2 h-2 rounded-full bg-white/20" />
										<span className="w-2 h-2 rounded-full bg-white/20" />
										<span className="ml-1 text-white/70">Visual Studio Code — Project Dashboard</span>
									</div>
									<span>1080p • 60 FPS</span>
								</div>

								{/* Screen Content Body */}
								<div className="flex-1 p-5 font-mono text-[11px] leading-relaxed text-slate-300 flex flex-col justify-between">
									<div className="space-y-2">
										<div className="flex items-center gap-2 text-purple-400">
											<span>import</span> <span className="text-amber-300">{"{ RecordAutoZoom }"}</span> <span>from</span> <span className="text-emerald-300">'@record-autozoom/core'</span>;
										</div>
										<div className="text-white/40">// Auto-Zoom camera follows mouse trajectory with smooth ease-out curves</div>
										<div className="flex items-center gap-2">
											<span className="text-blue-400">const</span> <span>recorder</span> = <span className="text-blue-400">new</span> <span className="text-yellow-300">RecordAutoZoom</span>({"{"}
										</div>
										<div className="pl-4 text-white/70">
											<span>cursorStyle: </span><span className="text-orange-300">"{activeCursor}"</span>,<br />
											<span>zoomScale: </span><span className="text-cyan-300">2.5</span>,<br />
											<span>smoothingFactor: </span><span className="text-cyan-300">0.85</span>,<br />
											<span>gpuAcceleration: </span><span className="text-emerald-300">true</span>
										</div>
										<div>{"}"});</div>
									</div>

									{/* Simulated Cursor with Glow and Zoom target */}
									<div className="relative self-center my-auto flex flex-col items-center">
										{/* Glow circle */}
										<div className="absolute -inset-6 bg-gradient-to-r from-orange-500 to-purple-500 rounded-full blur-xl opacity-60 animate-pulse" />
										{/* Cursor Icon */}
										<div className="relative z-10 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-orange-400/50 shadow-2xl">
											<Cursor size={20} weight="fill" className="text-orange-400" />
											<span className="text-xs font-sans font-semibold text-white">Auto-Zoom Target</span>
										</div>
									</div>
								</div>

								{/* Floating Mini HUD at Bottom */}
								<div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#180927]/95 border border-white/20 shadow-2xl backdrop-blur-2xl text-xs text-white">
									<div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
									<span className="font-semibold text-rose-400">REC</span>
									<span className="text-white/40">|</span>
									<span className="text-white/80 font-mono">00:03:42</span>
									<span className="text-white/40">|</span>
									<span className="text-purple-300">HUD Sunset Obsidian</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Grid */}
			<section id="features" className="relative z-10 py-24 px-4 sm:px-6 max-w-6xl mx-auto border-t border-white/[0.08]">
				<div className="text-center max-w-2xl mx-auto mb-16">
					<span className="text-xs font-bold uppercase tracking-widest text-orange-400">Tính năng cao cấp</span>
					<h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-2 mb-4">
						Mọi thứ bạn cần cho một video triệu view
					</h2>
					<p className="text-base text-white/60">
						Được thiết kế tinh gọn nhưng tích hợp toàn bộ các công nghệ quay màn hình và hậu kỳ tự động hiện đại nhất.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{FEATURES.map((item, idx) => {
						const IconComponent = item.icon;
						return (
							<div
								key={idx}
								className="group relative p-6 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-purple-400/40 transition-all duration-300 shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1"
							>
								<div className="flex items-center justify-between mb-4">
									<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-orange-500/20 border border-white/15 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
										<IconComponent size={24} weight="duotone" />
									</div>
									<span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
										{item.tag}
									</span>
								</div>
								<h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors mb-2">
									{item.title}
								</h3>
								<p className="text-sm text-white/60 leading-relaxed">
									{item.desc}
								</p>
							</div>
						);
					})}
				</div>
			</section>

			{/* Cursor Styles Showcase */}
			<section id="cursors" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-white/[0.08]">
				<div className="text-center max-w-2xl mx-auto mb-14">
					<span className="text-xs font-bold uppercase tracking-widest text-purple-400">Đặc sắc</span>
					<h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2 mb-4">
						Bộ 8 Con Trỏ Chuột Tùy Biến
					</h2>
					<p className="text-sm sm:text-base text-white/60">
						Chọn nhanh kiểu con trỏ phù hợp với phong cách của bạn: từ tinh tế như macOS đến viền phát sáng công nghệ cao.
					</p>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
					{CURSOR_PREVIEWS.map((c) => {
						const isSelected = activeCursor === c.id;
						return (
							<button
								key={c.id}
								type="button"
								onClick={() => setActiveCursor(c.id)}
								className={`flex flex-col p-4 rounded-2xl text-left border transition-all duration-200 outline-none ${
									isSelected
										? "bg-purple-600/20 border-orange-400 shadow-[0_0_25px_rgba(249,115,22,0.3)] scale-[1.02]"
										: "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
								}`}
							>
								<div className="flex items-center justify-between mb-3">
									<div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
										<Cursor size={18} weight="fill" className={isSelected ? "text-orange-400" : "text-white/70"} />
									</div>
									<span className="text-[9px] font-bold text-white/40 uppercase">{c.tag}</span>
								</div>
								<div className="text-xs font-bold text-white mb-1">{c.label}</div>
								<div className="text-[10px] text-white/50 leading-tight">{c.desc}</div>
							</button>
						);
					})}
				</div>
			</section>

			{/* Download CTA Matrix Section */}
			<section id="download" className="relative z-10 py-24 px-4 sm:px-6 max-w-5xl mx-auto">
				<div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-br from-purple-950/60 via-[#19062b] to-[#0f031b] border border-white/20 shadow-[0_20px_80px_rgba(0,0,0,0.8)] text-center">
					{/* Ambient glow */}
					<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-orange-500/20 blur-[100px] rounded-full pointer-events-none" />

					<div className="relative z-10 max-w-2xl mx-auto">
						<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-400/30 mb-5">
							<Lightning size={14} weight="fill" /> Tải về trực tiếp tốc độ cao
						</span>
						<h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
							Bắt đầu tạo video ấn tượng ngay hôm nay
						</h2>
						<p className="text-base text-white/70 mb-8">
							Tải bản cài đặt Windows chính thức từ Cloudflare R2, cài đặt chỉ trong 10 giây và sử dụng vĩnh viễn miễn phí.
						</p>

						<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
							<a
								href={WINDOWS_DOWNLOAD_URL}
								className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-xl shadow-orange-500/35 transition-all duration-150 active:scale-95"
							>
								<WindowsLogo size={22} weight="fill" />
								<span>Tải Bản Cài Đặt Cho Windows (.exe)</span>
							</a>

							<button
								type="button"
								onClick={onOpenWebEditor}
								className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all active:scale-95"
							>
								<Monitor size={20} />
								<span>Dùng Trên Trình Duyệt</span>
							</button>
						</div>

						<div className="text-xs text-white/40">
							Tương thích Windows 10, Windows 11 (64-bit) • Dung lượng: 358.5 MB • Không chứa phần mềm quảng cáo
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="relative z-10 border-t border-white/[0.08] py-10 px-4 sm:px-6 text-center text-xs text-white/50">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<span className="font-bold text-sm text-white/80">Record Auto-Zoom</span>
						<span>— Studio quay màn hình thông minh</span>
					</div>

					<div className="flex items-center gap-6">
						<a href={WINDOWS_DOWNLOAD_URL} className="hover:text-white transition-colors">Tải cho Windows</a>
						<button type="button" onClick={onOpenWebEditor} className="hover:text-white transition-colors">Web Editor</button>
						<a href="#features" className="hover:text-white transition-colors">Tính năng</a>
					</div>

					<div>© 2026 Record Auto-Zoom. All rights reserved.</div>
				</div>
			</footer>
		</div>
	);
}
