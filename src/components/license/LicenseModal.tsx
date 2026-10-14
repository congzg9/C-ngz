import { useState, useEffect } from "react";
import {
	Check,
	Copy,
	ShieldCheck,
	ArrowSquareOut as ExternalLink,
	ArrowClockwise as RefreshCw,
	Crown,
	CreditCard,
	EnvelopeSimple,
} from "@phosphor-icons/react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";

interface LicenseModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onLicenseChanged?: (isPro: boolean) => void;
}

export function LicenseModal({ open, onOpenChange, onLicenseChanged }: LicenseModalProps) {
	const { locale } = useI18n();
	const isVi = locale === "vi";

	const [machineId, setMachineId] = useState<string>("Đang tải...");
	const [licenseKey, setLicenseKey] = useState<string>("");
	const [email, setEmail] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const [licenseStatus, setLicenseStatus] = useState<{
		isPro: boolean;
		type: string;
		key?: string;
		email?: string;
		expiresAt?: number | null;
	}>({ isPro: false, type: "none" });

	const [copiedMachineId, setCopiedMachineId] = useState<boolean>(false);

	useEffect(() => {
		if (open) {
			window.electronAPI?.hudOverlaySetFocusable?.(true);
			window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
		} else {
			window.electronAPI?.hudOverlaySetFocusable?.(false);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;

		void (async () => {
			try {
				let currentMid = machineId;
				if (window.electronAPI?.getMachineId) {
					const id = await window.electronAPI.getMachineId();
					setMachineId(id);
					currentMid = id;
				}
				if (window.electronAPI?.getLicenseStatus) {
					const status = await window.electronAPI.getLicenseStatus(true);
					setLicenseStatus(status);
					if (status.key) {
						setLicenseKey(status.key);
					}
					if (status.email) {
						setEmail(status.email);
					}

					// Nếu chưa là PRO, tự động kiểm tra xem máy này đã từng thanh toán trên web chưa
					if (!status.isPro && currentMid && currentMid.startsWith("REC-")) {
						try {
							const res = await fetch(`https://record-autozoom.pages.dev/api/check-payment?machineId=${encodeURIComponent(currentMid)}`);
							if (res.ok) {
								const checkData = await res.json();
								if (checkData.paid && checkData.licenseKey) {
									const actRes = await window.electronAPI.activateLicense(checkData.licenseKey);
									if (actRes.success && actRes.license) {
										setLicenseStatus(actRes.license);
										setLicenseKey(checkData.licenseKey);
										toast.success(
											isVi
												? "🎉 Nhận diện thanh toán thành công! Bản quyền PRO đã được tự động kích hoạt!"
												: "🎉 Verified payment! PRO License has been automatically activated!"
										);
										onLicenseChanged?.(true);
									}
								}
							}
						} catch (_) {}
					}
				}
			} catch (err) {
				console.warn("Could not load license status:", err);
			}
		})();
	}, [open]);

	const handleAutoSync = async (explicit = false) => {
		try {
			let currentMid = machineId;
			if (!currentMid || currentMid === "Đang tải...") {
				if (window.electronAPI?.getMachineId) {
					currentMid = await window.electronAPI.getMachineId();
					setMachineId(currentMid);
				}
			}
			if (!currentMid || !currentMid.startsWith("REC-")) {
				if (explicit) toast.error(isVi ? "Chưa xác định được Mã máy." : "Machine ID not ready.");
				return;
			}

			if (explicit) setLoading(true);

			const res = await fetch(`https://record-autozoom.pages.dev/api/check-payment?machineId=${encodeURIComponent(currentMid)}`);
			if (res.ok) {
				const checkData = await res.json();
				if (checkData.paid && checkData.licenseKey) {
					const actRes = await window.electronAPI.activateLicense(checkData.licenseKey);
					if (actRes.success && actRes.license) {
						setLicenseStatus(actRes.license);
						setLicenseKey(checkData.licenseKey);
						toast.success(
							isVi
								? "🎉 Nhận diện đơn hàng thành công! Bản quyền PRO đã được tự động kích hoạt!"
								: "🎉 Verified purchase! PRO License has been automatically activated!"
						);
						onLicenseChanged?.(true);
						return;
					}
				}
			}

			if (explicit) {
				toast.info(
					isVi
						? "Chưa tìm thấy giao dịch đã hoàn tất cho mã máy này. Nếu vừa thanh toán xong, vui lòng đợi 15-30 giây để hệ thống xử lý rồi thử lại."
						: "No completed purchase found yet for this machine. Please wait 15-30 seconds and try again."
				);
			}
		} catch (err) {
			if (explicit) {
				toast.error(isVi ? "Lỗi kết nối đến máy chủ xác thực." : "Failed to connect to verification server.");
			}
		} finally {
			if (explicit) setLoading(false);
		}
	};

	const handleCopyMachineId = () => {
		if (window.electronAPI?.copyToClipboard) {
			window.electronAPI.copyToClipboard(machineId);
		}
		try {
			navigator.clipboard.writeText(machineId);
		} catch (_) {}
		setCopiedMachineId(true);
		setTimeout(() => setCopiedMachineId(false), 2000);
		toast.success(isVi ? "Đã sao chép Mã máy!" : "Machine ID copied to clipboard!");
	};

	const handleCopyEmail = () => {
		if (window.electronAPI?.copyToClipboard) {
			window.electronAPI.copyToClipboard("Giangcong1089@gmail.com");
		}
		try {
			navigator.clipboard.writeText("Giangcong1089@gmail.com");
		} catch (_) {}
		toast.success(isVi ? "Đã sao chép email hỗ trợ: Giangcong1089@gmail.com" : "Support email copied: Giangcong1089@gmail.com");
	};

	const openCheckoutWeb = () => {
		const targetUrl = `https://record-autozoom.pages.dev/checkout?machineId=${encodeURIComponent(machineId)}`;
		if (window.electronAPI?.openExternalUrl) {
			window.electronAPI.openExternalUrl(targetUrl);
		} else {
			window.open(targetUrl, "_blank");
		}
	};

	const handleActivate = async () => {
		if (!licenseKey.trim()) {
			toast.error(isVi ? "Vui lòng nhập Mã kích hoạt (License Key)!" : "Please enter your License Key!");
			return;
		}

		setLoading(true);
		try {
			const res = await window.electronAPI.activateLicense(licenseKey.trim(), email.trim());
			if (res.success && res.license) {
				setLicenseStatus(res.license);
				toast.success(res.message || (isVi ? "Kích hoạt bản quyền PRO thành công!" : "PRO License activated successfully!"));
				onLicenseChanged?.(true);
			} else {
				toast.error(res.message || (isVi ? "Mã kích hoạt không đúng hoặc không khớp với máy này." : "Invalid license key or not matching this machine."));
			}
		} catch (err) {
			toast.error(isVi ? `Lỗi kích hoạt: ${(err as Error).message}` : `Activation error: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleDeactivate = async () => {
		try {
			await window.electronAPI.deactivateLicense();
			setLicenseStatus({ isPro: false, type: "none" });
			setLicenseKey("");
			toast.info(isVi ? "Đã hủy kích hoạt bản quyền trên thiết bị này." : "License deactivated on this device.");
			onLicenseChanged?.(false);
		} catch (err) {
			toast.error(isVi ? "Không thể hủy kích hoạt." : "Failed to deactivate license.");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				data-hud-interactive="true"
				className="pointer-events-auto max-w-[480px] bg-gradient-to-b from-[#25083f] via-[#1a052e] to-[#0e021a]/98 backdrop-blur-3xl border border-white/[0.16] text-white shadow-[0_35px_100px_rgba(0,0,0,0.95),0_0_80px_rgba(249,115,22,0.2)] p-7 !rounded-[32px] sm:!rounded-[32px] outline-none overflow-hidden z-[10000]"
			>
				{/* Hiệu ứng ánh sáng hoàng hôn Sunset Glow đa tầng */}
				<div
					aria-hidden="true"
					className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-purple-500/35 via-violet-600/25 to-transparent blur-3xl pointer-events-none rounded-full"
				/>
				<div
					aria-hidden="true"
					className="absolute top-1/3 -left-16 w-44 h-44 bg-orange-500/20 blur-3xl pointer-events-none rounded-full"
				/>
				<div
					aria-hidden="true"
					className="absolute -bottom-16 -right-10 w-56 h-56 bg-gradient-to-tl from-amber-500/20 via-orange-600/15 to-transparent blur-3xl pointer-events-none rounded-full"
				/>

				{/* Header sang trọng: Căn giữa hoàn toàn */}
				<DialogHeader className="text-center pb-2 relative z-10 flex flex-col items-center justify-center">
					{/* Icon Vương miện Hoàng gia nổi bật ở giữa với ánh hoàng hôn */}
					<div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/25 via-orange-500/20 to-purple-800/35 border border-amber-400/40 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.35)] mb-3">
						<Crown className="w-6 h-6 text-amber-300 drop-shadow-[0_2px_12px_rgba(245,158,11,0.6)]" weight="fill" />
					</div>

					{/* Tên phần mềm RECORD-AUTOZOOM */}
					<div className="flex items-center justify-center gap-2 mb-1.5 flex-wrap">
						<DialogTitle className="text-[20px] font-bold text-white tracking-tight">
							RECORD-AUTOZOOM
						</DialogTitle>
						<span className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider uppercase shadow-[0_0_15px_rgba(245,158,11,0.4)]">
							PRO
						</span>
					</div>

					<p className="text-[13px] text-zinc-300 font-normal text-center max-w-[360px] leading-relaxed">
						{isVi
							? "Mở khóa toàn bộ sức mạnh quay & xuất video 4K sắc nét"
							: "Unlock the full power of screen recording & 4K video export"}
					</p>
				</DialogHeader>

				{licenseStatus.isPro ? (
					// ─── TRẠNG THÁI PRO ĐÃ KÍCH HOẠT (LUXURY ACTIVE) ───
					<div className="space-y-4 py-2 relative z-10">
						<div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-500/15 via-emerald-950/25 to-black/50 p-4.5 text-center space-y-1.5 shadow-[0_4px_30px_rgba(16,185,129,0.18)]">
							<div className="inline-flex items-center justify-center gap-2 text-emerald-300 font-bold text-sm">
								<ShieldCheck className="h-5 w-5 text-emerald-400" weight="fill" />
								<span className="tracking-wide">
									{isVi ? "BẢN QUYỀN PRO ĐANG HOẠT ĐỘNG" : "PRO LICENSE ACTIVE"}
								</span>
							</div>
							<p className="text-xs text-zinc-300">
								{licenseStatus.expiresAt
									? (isVi
										? `Thời hạn sử dụng đến: ${new Date(licenseStatus.expiresAt).toLocaleDateString("vi-VN")}`
										: `Expires on: ${new Date(licenseStatus.expiresAt).toLocaleDateString("en-US")}`)
									: (isVi ? "Gói sở hữu: Vĩnh Viễn (Trọn Đời)" : "Plan: Lifetime (Permanent)")}
							</p>
							{licenseStatus.email && (
								<p className="text-[11px] text-zinc-400">Email: {licenseStatus.email}</p>
							)}
						</div>

						<div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-1.5 backdrop-blur-md">
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-zinc-400 font-medium">
									{isVi ? "Mã máy thiết bị:" : "Machine ID:"}
								</span>
								<span className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider">
									{isVi ? "ĐÃ XÁC THỰC" : "VERIFIED"}
								</span>
							</div>
							<div className="font-mono text-xs text-zinc-200 select-all tracking-wider font-semibold">
								{machineId}
							</div>
						</div>

						{/* Nút hủy kích hoạt */}
						<div className="flex justify-center pt-2">
							<button
								type="button"
								onClick={handleDeactivate}
								className="text-xs text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer font-medium py-1 px-3 rounded-lg hover:bg-white/5"
							>
								{isVi ? "Hủy kích hoạt trên máy này" : "Deactivate on this device"}
							</button>
						</div>
					</div>
				) : (
					// ─── CHƯA KÍCH HOẠT: HIỆN ĐẠI & PHONG CÁCH SUNSET HOÀNG HÔN ───
					<div className="space-y-4 pt-1 relative z-10">
						
						{/* Banner đặc quyền bản quyền PRO (Thay thế note 5 lượt) */}
						<div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-purple-950/20 to-orange-500/10 p-3 text-center space-y-1 backdrop-blur-md">
							<div className="flex items-center justify-center gap-3 text-[11.5px] font-semibold text-amber-200/90 flex-wrap">
								<span>✦ Xuất video 4K & Full HD sắc nét</span>
								<span>✦ Không dính logo bản quyền</span>
								<span>✦ Tự động Zoom AI</span>
							</div>
						</div>

						{/* KHỐI 1: ĐÃ CÓ MÃ - DÁN MÃ KÍCH HOẠT */}
						<div className="rounded-2xl border border-purple-400/25 bg-gradient-to-b from-purple-900/35 via-violet-950/20 to-black/50 p-4 space-y-3 shadow-[0_4px_25px_rgba(147,51,234,0.12)] backdrop-blur-md">
							<div className="space-y-1">
								<label className="text-[13px] font-semibold text-zinc-100 block">
									{isVi ? "Kích hoạt bản quyền" : "Activate License"}
								</label>
								<p className="text-[12px] text-zinc-400">
									{isVi
										? "Nhập mã bản quyền nhận được sau khi thanh toán:"
										: "Enter the license key received after checkout:"}
								</p>
							</div>

							<Input
								value={licenseKey}
								onChange={(e) => setLicenseKey(e.target.value)}
								placeholder="REC-XXXX-XXXX-XXXX-..."
								className="font-mono text-[12.5px] bg-black/50 border border-white/15 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 h-11 rounded-xl px-3.5 tracking-wider shadow-inner"
							/>

							{/* Nút kích hoạt: Thủ công & Tự động đồng bộ */}
							<div className="flex gap-2">
								<Button
									type="button"
									onClick={handleActivate}
									disabled={loading}
									className="flex-1 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-[13px] h-11 rounded-xl shadow-[0_4px_20px_rgba(139,92,246,0.35)] hover:shadow-[0_6px_25px_rgba(139,92,246,0.5)] transition-all cursor-pointer active:scale-[0.99] tracking-wide"
								>
									{loading ? (
										<>
											<RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
											{isVi ? "Đang xác thực..." : "Verifying..."}
										</>
									) : (
										isVi ? "Kích hoạt bằng mã" : "Activate with Key"
									)}
								</Button>
								<Button
									type="button"
									onClick={() => handleAutoSync(true)}
									disabled={loading}
									variant="outline"
									title={isVi ? "Tự động nhận diện bản quyền nếu bạn đã thanh toán trên trang web" : "Auto-detect paid license from website"}
									className="bg-white/5 hover:bg-white/10 border-white/20 text-amber-300 hover:text-amber-200 text-[12px] h-11 rounded-xl px-3 flex items-center gap-1.5 transition-all cursor-pointer font-medium"
								>
									<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
									<span>{isVi ? "Tự kích hoạt" : "Auto Sync"}</span>
								</Button>
							</div>
						</div>

						{/* KHỐI 2: CHƯA MUA - THANH TOÁN QUA CỔNG PAYPAL */}
						<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 backdrop-blur-md">
							<div className="flex items-center justify-between">
								<span className="text-[12.5px] font-medium text-zinc-300">
									{isVi ? "Mã máy của bạn (Machine ID):" : "Your Machine ID:"}
								</span>
								<button
									type="button"
									onClick={handleCopyMachineId}
									className="flex items-center gap-1.5 text-[11px] text-zinc-300 hover:text-white transition-colors cursor-pointer font-medium bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg border border-white/10"
								>
									{copiedMachineId ? (
										<>
											<Check className="h-3.5 w-3.5 text-emerald-400" />
											<span className="text-emerald-300 font-semibold">
												{isVi ? "Đã chép" : "Copied"}
											</span>
										</>
									) : (
										<>
											<Copy className="h-3.5 w-3.5" />
											<span>{isVi ? "Sao chép" : "Copy"}</span>
										</>
									)}
								</button>
							</div>

							<div className="font-mono text-[13px] text-amber-200 bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 select-all tracking-wider font-semibold shadow-inner">
								{machineId}
							</div>

							{/* Nút thanh toán PayPal & Thẻ quốc tế */}
							<button
								type="button"
								onClick={openCheckoutWeb}
								className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#ff5e00] via-[#ff7a00] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,94,0,0.35)] hover:shadow-[0_6px_25px_rgba(255,94,0,0.5)] transition-all cursor-pointer active:scale-[0.99] tracking-wide"
							>
								<CreditCard className="h-4.5 w-4.5 text-amber-100" weight="fill" />
								<span>
									{isVi
										? "Nâng cấp qua PayPal & Thẻ quốc tế (Visa / Master)"
										: "Upgrade via PayPal & Credit Card (Visa / Master)"}
								</span>
								<ExternalLink className="h-4 w-4 opacity-80" />
							</button>

							<p className="text-[11.5px] text-zinc-400 text-center font-normal">
								{isVi
									? "Gói Vĩnh Viễn: $35 USD • Gói 1 Tháng: $5 USD • Cấp mã tức thì 24/7"
									: "Lifetime: $35 USD • 1 Month: $5 USD • Instant delivery 24/7"}
							</p>
						</div>

						{/* Hỗ trợ & Liên hệ email chính chủ ở chân modal */}
						<div className="flex items-center justify-between pt-1 px-1 text-[12px]">
							<span className="text-zinc-400">
								{isVi ? "Hỗ trợ & Kích hoạt 24/7:" : "Support & Activation:"}
							</span>
							<div className="flex items-center gap-1.5">
								<a
									href="mailto:Giangcong1089@gmail.com"
									onClick={(e) => {
										if (window.electronAPI?.openExternalUrl) {
											e.preventDefault();
											window.electronAPI.openExternalUrl("mailto:Giangcong1089@gmail.com");
										}
									}}
									className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-medium transition-colors cursor-pointer"
									title="Bấm để gửi email"
								>
									<EnvelopeSimple className="w-3.5 h-3.5 text-amber-400" weight="fill" />
									<span>Giangcong1089@gmail.com</span>
								</a>
								<button
									type="button"
									onClick={handleCopyEmail}
									title={isVi ? "Sao chép email" : "Copy email"}
									className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded hover:bg-white/10 cursor-pointer"
								>
									<Copy className="w-3.5 h-3.5" />
								</button>
							</div>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}


