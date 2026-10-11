#!/usr/bin/env node
/**
 * Recordly PRO - Official License Key Generator
 * Usage:
 *   node scripts/keygen.mjs <MACHINE_ID> [duration]
 *
 * Examples:
 *   node scripts/keygen.mjs REC-8F92-4A1C-9B3D lifetime
 *   node scripts/keygen.mjs REC-8F92-4A1C-9B3D 30d
 *   node scripts/keygen.mjs REC-8F92-4A1C-9B3D 365d
 */

import crypto from "node:crypto";

const LICENSE_SECRET_KEY = "RECORDLY_PRO_MASTER_SECRET_2026_COMMERCIAL";

const args = process.argv.slice(2);
const machineId = args[0]?.trim()?.toUpperCase();
const durationArg = args[1]?.trim()?.toLowerCase() || "lifetime";

if (!machineId || !machineId.startsWith("REC-")) {
	console.log(`
=====================================================
  🔑 Recordly PRO - License Key Generator
=====================================================
Lỗi: Thiếu Mã máy (Machine ID) của khách hàng!

Cú pháp:
  node scripts/keygen.mjs <MACHINE_ID> [lifetime | 30d | 90d | 365d]

Ví dụ:
  node scripts/keygen.mjs REC-8F92-4A1C-9B3D lifetime
  node scripts/keygen.mjs REC-8F92-4A1C-9B3D 30d
=====================================================
`);
	process.exit(1);
}

let expiresAt = 0; // 0 = Lifetime

if (durationArg !== "lifetime") {
	const match = durationArg.match(/^(\d+)d$/);
	if (match) {
		const days = Number.parseInt(match[1], 10);
		expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
	} else {
		console.error("Thời hạn không hợp lệ! Hãy dùng: lifetime, 30d, 90d, 365d");
		process.exit(1);
	}
}

const expiryStr = expiresAt === 0 ? "0" : expiresAt.toString();

const signature = crypto
	.createHmac("sha256", LICENSE_SECRET_KEY)
	.update(`${machineId}:${expiryStr}`)
	.digest("hex")
	.substring(0, 8)
	.toUpperCase();

const fullLicenseKey = `${machineId}-${expiryStr}-${signature}`;

console.log(`
=====================================================
  🎉 TẠO LICENSE KEY THÀNH CÔNG!
=====================================================
Mã máy khách hàng: ${machineId}
Thời hạn:          ${expiresAt === 0 ? "VĨNH VIỄN (LIFETIME)" : new Date(expiresAt).toLocaleDateString("vi-VN")}
-----------------------------------------------------
👉 LICENSE KEY ĐỂ GỬI CHO KHÁCH HÀNG:

   ${fullLicenseKey}

-----------------------------------------------------
Hướng dẫn gửi khách:
Khách chỉ cần mở Recordly -> Bấm "Kích hoạt PRO" -> Dán mã trên vào là xong!
=====================================================
`);
