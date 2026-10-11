import crypto from "crypto";

const LICENSE_SECRET_KEY = process.env.LICENSE_SECRET_KEY || "RECORDLY_PRO_MASTER_SECRET_2026_COMMERCIAL";

/**
 * Sinh License Key chuẩn HMAC SHA-256 từ Machine ID và thời hạn (0 = vĩnh viễn)
 */
export function generateLicenseKey(machineId, durationDays = 0) {
	const cleanMachineId = machineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
	if (!cleanMachineId) {
		throw new Error("Machine ID không hợp lệ");
	}

	const expiryTimestamp = durationDays > 0 
		? Date.now() + durationDays * 24 * 60 * 60 * 1000 
		: 0;

	const payload = `${cleanMachineId}:${expiryTimestamp}`;
	const signature = crypto
		.createHmac("sha256", LICENSE_SECRET_KEY)
		.update(payload)
		.digest("hex")
		.toUpperCase()
		.slice(0, 8);

	// Format: REC-XXXX-XXXX-XXXX-0-SIGNATURE
	const formattedMachine = cleanMachineId.startsWith("REC")
		? cleanMachineId.slice(3)
		: cleanMachineId;

	const parts = formattedMachine.match(/.{1,4}/g) || [formattedMachine];
	const machinePart = parts.join("-");

	return `REC-${machinePart}-${expiryTimestamp}-${signature}`;
}
