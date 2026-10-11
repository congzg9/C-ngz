import fs from "fs";
import path from "path";
import { sendLicenseEmail } from "./lib/mailer.js";
import { generateLicenseKey } from "./lib/keygen.js";

// Tự động nạp file .env
try {
	const envContent = fs.readFileSync(".env", "utf-8");
	for (const line of envContent.split("\n")) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
			const [key, ...rest] = trimmed.split("=");
			process.env[key.trim()] = rest.join("=").trim();
		}
	}
} catch (e) {
	console.warn("Không thể đọc .env:", e.message);
}

async function runTest() {
	console.log("=== BẮT ĐẦU TEST TỰ ĐỘNG GỬI EMAIL KHI MUA BẢN QUYỀN ===");

	const testMachineId = "REC-8F92-4A1C-9B3D";
	const testKey = generateLicenseKey(testMachineId, 30); // Giả lập gói tháng 30 ngày
	const targetEmail = (process.env.TEST_EMAIL || "giangcong1089@gmail.com").trim().toLowerCase();

	console.log(`- Mã máy test: ${testMachineId}`);
	console.log(`- License Key sinh ra: ${testKey}`);
	console.log(`- Gửi tới: ${targetEmail}`);

	try {
		const result = await sendLicenseEmail({
			toEmail: targetEmail,
			customerName: "Nguyễn Giang Công (Khách Mua Test)",
			licenseKey: testKey,
			machineId: testMachineId,
		});

		console.log("\n📬 Phản hồi từ Resend API:");
		console.log(result);

		if (result && result.id) {
			console.log("\n🎉 ĐÃ GỬI EMAIL THẬT THÀNH CÔNG VÀO HÒM THƯ GMAIL CỦA BẠN!");
			console.log(`👉 Resend Email ID: ${result.id}`);
			console.log("👉 Bạn hãy mở hộp thư Gmail: giangcong1089@gmail.com ngay bây giờ để kiểm tra nhé!");
		} else if (result.simulated) {
			console.log("\n⚠️ Hệ thống đang ở chế độ Giả lập (Dev Mode) vì chưa có RESEND_API_KEY.");
		} else {
			console.log("\n❌ Resend báo lỗi:", result);
		}
	} catch (err) {
		console.error("❌ Lỗi khi gửi email:", err.message);
	}
}

runTest();
