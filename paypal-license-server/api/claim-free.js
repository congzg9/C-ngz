import { generateLicenseKey } from "../lib/keygen.js";
import { sendLicenseEmail } from "../lib/mailer.js";

const VALID_100_COUPONS = ["FREE100", "PRO100", "GIAM100"];

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { machineId, couponCode, durationDays = 0 } = req.body || {};

		if (!machineId) {
			return res.status(400).json({ error: "Thiếu Machine ID" });
		}

		const codeUpper = (couponCode || "").trim().toUpperCase();
		if (!VALID_100_COUPONS.includes(codeUpper)) {
			return res.status(400).json({ error: "Mã giảm giá không hợp lệ hoặc không áp dụng ưu đãi 100%" });
		}

		const duration = Number(durationDays) || 0;
		const licenseKey = generateLicenseKey(machineId, duration);

		sendLicenseEmail({
			toEmail: "giangcong1089@gmail.com",
			customerName: `Khách mã 100% [${codeUpper}]`,
			licenseKey,
			machineId,
		}).catch((err) => {
			console.error("Gửi email thất bại:", err);
		});

		return res.status(200).json({
			success: true,
			licenseKey,
			machineId,
			message: "Kích hoạt bản quyền miễn phí 100% thành công!",
		});
	} catch (err) {
		console.error("claim-free error:", err);
		return res.status(500).json({ error: err.message });
	}
}
