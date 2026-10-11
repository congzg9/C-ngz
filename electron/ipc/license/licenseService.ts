import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { USER_DATA_PATH } from "../../appPaths";
import { getOrCreateMachineId } from "./machineId";

const LICENSE_FILE = path.join(USER_DATA_PATH, "license.json");

// Secret key used to generate and verify hardware-bound license keys.
// Keep this secret! Only you and your keygen script know this.
export const LICENSE_SECRET_KEY = "RECORDLY_PRO_MASTER_SECRET_2026_COMMERCIAL";

export interface LicenseStatus {
	isPro: boolean;
	type: "none" | "machine" | "payhip";
	key?: string;
	email?: string;
	machineId: string;
	activatedAt?: number;
	expiresAt?: number | null; // null = lifetime
	message?: string;
}

export interface ActivationResult {
	success: boolean;
	message: string;
	license?: LicenseStatus;
}

/**
 * Verify a Machine-ID bound offline license key.
 * Expected format: REC-{MACHINE_ID_PARTS}-{EXPIRES_AT}-{SIGNATURE}
 * Example: REC-8F92-4A1C-9B3D-0-A1B2C3D4
 */
export function verifyMachineLicenseKey(key: string, currentMachineId: string): { valid: boolean; expiresAt: number | null; message: string } {
	const trimmedKey = key.trim().toUpperCase();
	if (!trimmedKey.startsWith("REC-")) {
		return { valid: false, expiresAt: null, message: "Mã kích hoạt không đúng định dạng Recordly." };
	}

	const parts = trimmedKey.split("-");
	// Format: REC, P1, P2, P3, EXPIRES, SIG  (total 6 segments)
	if (parts.length < 6) {
		return { valid: false, expiresAt: null, message: "Mã kích hoạt không hợp lệ (thiếu thành phần)." };
	}

	const keyMachineId = `REC-${parts[1]}-${parts[2]}-${parts[3]}`;
	if (keyMachineId !== currentMachineId) {
		return {
			valid: false,
			expiresAt: null,
			message: `Mã kích hoạt này chỉ dành cho máy ${keyMachineId}, không khớp với máy này (${currentMachineId}).`,
		};
	}

	const expiryStr = parts[4];
	const signature = parts[5];
	const expiresAt = expiryStr === "0" ? null : Number.parseInt(expiryStr, 10);

	if (expiresAt !== null && (!Number.isFinite(expiresAt) || Date.now() > expiresAt)) {
		return { valid: false, expiresAt, message: "Mã kích hoạt này đã hết hạn sử dụng." };
	}

	// Verify HMAC signature
	const expectedSignature = crypto
		.createHmac("sha256", LICENSE_SECRET_KEY)
		.update(`${keyMachineId}:${expiryStr}`)
		.digest("hex")
		.substring(0, 8)
		.toUpperCase();

	if (signature !== expectedSignature) {
		return { valid: false, expiresAt, message: "Mã kích hoạt không hợp lệ hoặc chữ ký sai." };
	}

	return { valid: true, expiresAt, message: "Kích hoạt thành công!" };
}


/**
 * Kiểm tra trạng thái thu hồi / xóa bản quyền từ máy chủ Cloudflare Pages
 * Timeout 3.5 giây để không làm chậm ứng dụng nếu mất mạng.
 * Nếu offline hoặc không có mạng: vẫn an toàn cho phép dùng offline.
 * Chỉ khi máy chủ phản hồi rõ ràng { revoked: true }: lập tức tự xóa license.json trên máy.
 */
export async function checkOnlineLicenseRevocation(
	machineId: string,
	licenseKey?: string
): Promise<{ revoked: boolean; reason?: string }> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3500);

		const url = new URL("https://record-autozoom.pages.dev/api/verify-license");
		url.searchParams.set("machineId", machineId);
		if (licenseKey) {
			url.searchParams.set("key", licenseKey);
		}

		const res = await fetch(url.toString(), {
			method: "GET",
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (res.ok) {
			const data = (await res.json().catch(() => ({}))) as {
				revoked?: boolean;
				valid?: boolean;
				message?: string;
			};

			if (data && data.revoked === true) {
				console.warn(`[License] Thiết bị ${machineId} đã bị Admin xóa/thu hồi:`, data.message);
				await deactivateLicense();
				return {
					revoked: true,
					reason: data.message || "Bản quyền của bạn đã bị Quản trị viên xóa hoặc thu hồi trên hệ thống.",
				};
			}
		}
	} catch {
		// Mất mạng hoặc timeout: cho phép chế độ offline an toàn
	}

	return { revoked: false };
}

/**
 * Read current persisted license status from disk.
 */
export async function getLicenseStatus(forceCheckOnline = false): Promise<LicenseStatus> {
	const machineId = await getOrCreateMachineId();

	if (!existsSync(LICENSE_FILE)) {
		return { isPro: false, type: "none", machineId };
	}

	try {
		const content = await fs.readFile(LICENSE_FILE, "utf-8");
		const data = JSON.parse(content) as LicenseStatus;

		// Check expiry
		if (data.expiresAt && Date.now() > data.expiresAt) {
			return { isPro: false, type: "none", machineId, message: "Bản quyền đã hết hạn sử dụng." };
		}

		// Re-verify if machine bound
		if (data.type === "machine" && data.key) {
			const check = verifyMachineLicenseKey(data.key, machineId);
			if (!check.valid) {
				return { isPro: false, type: "none", machineId, message: check.message };
			}

			// Nếu yêu cầu kiểm tra online ngay
			if (forceCheckOnline) {
				const onlineCheck = await checkOnlineLicenseRevocation(machineId, data.key);
				if (onlineCheck.revoked) {
					return { isPro: false, type: "none", machineId, message: onlineCheck.reason };
				}
			}
		}

		return { ...data, isPro: true, machineId };
	} catch {
		return { isPro: false, type: "none", machineId };
	}
}

/**
 * Activate license by Key (validates HMAC-SHA256 Machine-bound License Key).
 */
export async function activateLicense(key: string, userEmail?: string): Promise<ActivationResult> {
	const machineId = await getOrCreateMachineId();
	const trimmedKey = key.trim();

	if (!trimmedKey) {
		return { success: false, message: "Vui lòng nhập mã kích hoạt." };
	}

	// 1. Try Machine-ID bound license verification first (fast, works offline)
	if (trimmedKey.toUpperCase().startsWith("REC-")) {
		const machineCheck = verifyMachineLicenseKey(trimmedKey, machineId);
		if (machineCheck.valid) {
			// Kiểm tra xem mã này có đang bị đánh dấu thu hồi trên máy chủ không
			const onlineCheck = await checkOnlineLicenseRevocation(machineId, trimmedKey);
			if (onlineCheck.revoked) {
				return {
					success: false,
					message: onlineCheck.reason || "Mã kích hoạt này đã bị Quản trị viên thu hồi hoặc xóa trên hệ thống.",
				};
			}

			const licenseData: LicenseStatus = {
				isPro: true,
				type: "machine",
				key: trimmedKey.toUpperCase(),
				email: userEmail || "",
				machineId,
				activatedAt: Date.now(),
				expiresAt: machineCheck.expiresAt,
			};
			await fs.writeFile(LICENSE_FILE, JSON.stringify(licenseData, null, 2), "utf-8");
			return { success: true, message: "Kích hoạt bản quyền PRO thành công!", license: licenseData };
		}
		return { success: false, message: machineCheck.message };
	}

	return { success: false, message: "Mã kích hoạt không hợp lệ. Vui lòng kiểm tra lại mã (định dạng REC-...)" };
}

/**
 * Deactivate / Clear license on this computer.
 */
export async function deactivateLicense(): Promise<{ success: boolean }> {
	try {
		await fs.rm(LICENSE_FILE, { force: true });
	} catch {
		// ignore
	}
	return { success: true };
}

export const FREE_RECORDINGS_LIMIT = 5;
const USAGE_FILE = path.join(USER_DATA_PATH, "usage.json");
const CLOUD_TRIAL_API = "https://record-autozoom.pages.dev/api/trial";

interface UsageRecord {
	count: number;
	machineId: string;
	signature: string;
	updatedAt: number;
}

function calculateUsageSignature(machineId: string, count: number): string {
	return crypto
		.createHmac("sha256", LICENSE_SECRET_KEY)
		.update(`RECORDINGS:${machineId}:${count}`)
		.digest("hex")
		.slice(0, 16);
}

/**
 * Danh sách các đường dẫn ẩn lưu vết bản quyền trên hệ điều hành (Chống xóa AppData cài lại).
 * Các file này nằm ngoài thư mục cài đặt của app, không bị xóa khi khách gỡ bỏ phần mềm.
 */
function getAnchorFilePaths(): string[] {
	const anchors: string[] = [];
	try {
		const home = os.homedir();
		// Anchor 1: Thư mục Home của người dùng
		anchors.push(path.join(home, ".rec_system_cache"));

		if (process.platform === "win32") {
			// Anchor 2: Thư mục LocalAppData (khác với Roaming AppData)
			const localAppData = process.env.LOCALAPPDATA;
			if (localAppData) {
				anchors.push(path.join(localAppData, ".rec_hw_state"));
			}
			// Anchor 3: Thư mục ProgramData hệ thống
			const programData = process.env.PROGRAMDATA;
			if (programData) {
				anchors.push(path.join(programData, ".rec_az_marker"));
			}
		} else {
			// Anchor 2 & 3 cho macOS / Linux
			anchors.push(path.join(home, "Library", "Caches", ".rec_engine_marker"));
			anchors.push(path.join(home, ".config", ".rec_az_state"));
		}
	} catch {
		// ignore
	}
	return anchors;
}

async function readAnchorUsage(machineId: string, filePath: string): Promise<number> {
	try {
		if (!existsSync(filePath)) return 0;
		const raw = await fs.readFile(filePath, "utf-8");
		const data = JSON.parse(raw) as UsageRecord;
		if (data.machineId !== machineId) return 0;
		const expectedSig = calculateUsageSignature(machineId, data.count);
		if (data.signature !== expectedSig) return FREE_RECORDINGS_LIMIT;
		return Math.max(0, Number(data.count) || 0);
	} catch {
		return 0;
	}
}

async function writeAnchorUsage(machineId: string, count: number, filePath: string): Promise<void> {
	try {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		const data: UsageRecord = {
			count,
			machineId,
			signature: calculateUsageSignature(machineId, count),
			updatedAt: Date.now(),
		};
		await fs.writeFile(filePath, JSON.stringify(data), "utf-8");
	} catch {
		// Nếu không có quyền ghi ở một số thư mục hệ thống thì bỏ qua an toàn
	}
}

/**
 * Kiểm tra số lượt đã dùng của Machine ID trên Cloudflare KV server (Chống hack tuyệt đối)
 */
async function fetchCloudTrialUsage(machineId: string): Promise<number> {
	try {
		const clean = machineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2500);
		const res = await fetch(`${CLOUD_TRIAL_API}/check?machineId=${encodeURIComponent(clean)}`, {
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (res.ok) {
			const data = (await res.json()) as { used?: number };
			return Math.max(0, Number(data.used) || 0);
		}
	} catch {
		// Offline hoặc mất mạng, fallback an toàn về local
	}
	return 0;
}

/**
 * Đồng bộ số lượt đã dùng lên Cloudflare KV server
 */
async function syncCloudTrialUsage(machineId: string, count: number): Promise<void> {
	try {
		const clean = machineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3000);
		await fetch(`${CLOUD_TRIAL_API}/sync`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ machineId: clean, used: count }),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
	} catch {
		// Offline
	}
}

async function writePersistedUsageInternal(machineId: string, count: number, syncCloud = true): Promise<void> {
	const data: UsageRecord = {
		count,
		machineId,
		signature: calculateUsageSignature(machineId, count),
		updatedAt: Date.now(),
	};

	// 1. Ghi vào file chính thức trong AppData
	try {
		await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true });
		await fs.writeFile(USAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
	} catch (e) {
		console.warn("Could not save usage file:", e);
	}

	// 2. Ghi phân tán vào tất cả các vị trí ẩn của hệ điều hành
	for (const anchor of getAnchorFilePaths()) {
		await writeAnchorUsage(machineId, count, anchor);
	}

	// 3. Đồng bộ lên Cloudflare KV
	if (syncCloud) {
		void syncCloudTrialUsage(machineId, count);
	}
}

async function readPersistedUsage(machineId: string): Promise<number> {
	let localCount = 0;
	if (existsSync(USAGE_FILE)) {
		try {
			const raw = await fs.readFile(USAGE_FILE, "utf-8");
			const data = JSON.parse(raw) as UsageRecord;
			if (data.machineId === machineId) {
				const expectedSig = calculateUsageSignature(machineId, data.count);
				localCount = data.signature === expectedSig ? Math.max(0, Number(data.count) || 0) : FREE_RECORDINGS_LIMIT;
			}
		} catch {
			// ignore
		}
	}

	// Đọc từ toàn bộ các tệp ẩn trên hệ thống
	let maxCount = localCount;
	for (const anchor of getAnchorFilePaths()) {
		const c = await readAnchorUsage(machineId, anchor);
		if (c > maxCount) {
			maxCount = c;
		}
	}

	// Kiểm tra máy chủ Cloudflare KV nếu chưa chạm giới hạn (Chống trường hợp khách format AppData)
	if (maxCount < FREE_RECORDINGS_LIMIT) {
		const cloudCount = await fetchCloudTrialUsage(machineId);
		if (cloudCount > maxCount) {
			maxCount = cloudCount;
		}
	}

	// Nếu phát hiện gian lận (maxCount lớn hơn localCount), phục hồi lại toàn bộ hệ thống
	if (maxCount > localCount) {
		await writePersistedUsageInternal(machineId, maxCount, false);
	}

	return maxCount;
}

async function writePersistedUsage(machineId: string, count: number): Promise<void> {
	await writePersistedUsageInternal(machineId, count, true);
}

export interface RecordingUsageStats {
	isPro: boolean;
	recordingsUsed: number;
	recordingsLimit: number;
	remaining: number;
}

export async function getRecordingUsage(): Promise<RecordingUsageStats> {
	const license = await getLicenseStatus();
	if (license.isPro) {
		return {
			isPro: true,
			recordingsUsed: 0,
			recordingsLimit: FREE_RECORDINGS_LIMIT,
			remaining: 999999,
		};
	}

	const used = await readPersistedUsage(license.machineId);
	const remaining = Math.max(0, FREE_RECORDINGS_LIMIT - used);

	return {
		isPro: false,
		recordingsUsed: used,
		recordingsLimit: FREE_RECORDINGS_LIMIT,
		remaining,
	};
}

export interface CheckExportParams {
	quality?: string;
	width?: number;
	height?: number;
	format?: string;
}

export interface CheckCanRecordResult {
	allowed: boolean;
	remaining: number;
	requireWatermark?: boolean;
	isFhdOr4k?: boolean;
	message?: string;
}

export async function checkCanRecord(params?: CheckExportParams): Promise<CheckCanRecordResult> {
	const license = await getLicenseStatus();
	if (license.isPro) {
		// Kiểm tra ngầm xem key có bị xóa/thu hồi trên hệ thống không
		const onlineCheck = await checkOnlineLicenseRevocation(license.machineId, license.key);
		if (onlineCheck.revoked) {
			return {
				allowed: false,
				remaining: 0,
				message: onlineCheck.reason || "Bản quyền của bạn đã bị Quản trị viên xóa trên hệ thống! Vui lòng liên hệ để được hỗ trợ.",
			};
		}
		return { allowed: true, remaining: 999999, requireWatermark: false };
	}

	const usage = await getRecordingUsage();

	// Nếu vẫn còn trong 5 lượt dùng thử ban đầu: cho phép xuất Full tính năng (không watermark, không chặn)
	if (usage.remaining > 0) {
		return { allowed: true, remaining: usage.remaining, requireWatermark: false };
	}

	// Đã hết 5 lượt dùng thử miễn phí:
	// Xác định xem có đang chọn chất lượng Full HD (1080p) hoặc 4K hay không
	const quality = params?.quality?.toLowerCase();
	const width = params?.width ?? 0;
	const height = params?.height ?? 0;

	const isFhdOr4k =
		quality === "4k" ||
		quality === "high" ||
		quality === "source" ||
		quality === "good" ||
		height >= 1080 ||
		width >= 1920;

	if (isFhdOr4k) {
		return {
			allowed: false,
			remaining: 0,
			isFhdOr4k: true,
			requireWatermark: false,
			message: "Bạn đã dùng hết 5 lượt xuất chất lượng cao miễn phí! Độ phân giải Full HD (1080p) và 4K yêu cầu bản quyền PRO. Vui lòng chuyển sang độ phân giải 720p (Medium) hoặc nâng cấp bản quyền PRO.",
		};
	}

	// Các độ phân giải nhỏ hơn (720p / Medium, GIF, SD):
	// Cho phép render tiếp, dính logo bản quyền của app
	return {
		allowed: true,
		remaining: 0,
		isFhdOr4k: false,
		requireWatermark: true,
		message: "Xuất video với logo bản quyền của RECORD-AUTOZOOM (Chất lượng 720p).",
	};
}

export async function consumeRecording(): Promise<{ allowed: boolean; remaining: number; requireWatermark?: boolean; message?: string }> {
	const license = await getLicenseStatus();
	if (license.isPro) {
		return { allowed: true, remaining: 999999, requireWatermark: false };
	}

	const currentUsed = await readPersistedUsage(license.machineId);
	const newUsed = currentUsed + 1;
	await writePersistedUsage(license.machineId, newUsed);
	const remaining = Math.max(0, FREE_RECORDINGS_LIMIT - newUsed);

	return {
		allowed: true,
		remaining,
		requireWatermark: remaining === 0,
		message: remaining === 0
			? "Bạn đã dùng hết 5 lượt xuất video miễn phí! Các video tiếp theo ở độ phân giải 720p sẽ kèm logo bản quyền."
			: `Đã xuất video thành công! Bạn còn lại ${remaining}/${FREE_RECORDINGS_LIMIT} lượt xuất video miễn phí.`,
	};
}
