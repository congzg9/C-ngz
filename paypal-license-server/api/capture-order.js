import { getPayPalAccessToken, getPayPalBaseUrl } from "../lib/paypal-client.js";
import { generateLicenseKey } from "../lib/keygen.js";
import { sendLicenseEmail } from "../lib/mailer.js";

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { orderId, machineId, customerEmail } = req.body || {};

		if (!orderId || !machineId) {
			return res.status(400).json({ error: "Thiếu orderId hoặc machineId" });
		}

		const accessToken = await getPayPalAccessToken();
		const baseUrl = getPayPalBaseUrl();

		// 1. Capture tiền từ PayPal
		const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		const captureData = await response.json();

		if (!response.ok || captureData.status !== "COMPLETED") {
			return res.status(400).json({
				error: "Thanh toán chưa hoàn tất",
				details: captureData,
			});
		}

		// 2. Lấy thông tin người mua từ kết quả thanh toán
		const payer = captureData.payer || {};
		const email = customerEmail || payer.email_address;
		const customerName = payer.name?.given_name || "bạn";

		// 3. Tự động sinh License Key theo gói (30 ngày hoặc vĩnh viễn)
		const duration = Number(req.body?.durationDays) || 0;
		const licenseKey = generateLicenseKey(machineId, duration);

		// 4. Tự động gửi Email cho khách hàng trong nền
		if (email) {
			sendLicenseEmail({
				toEmail: email,
				customerName,
				licenseKey,
				machineId,
			}).catch((err) => {
				console.error("Gửi email thất bại:", err);
			});
		}

		// 5. Trả key về ngay trên màn hình để khách copy lập tức
		return res.status(200).json({
			success: true,
			status: "COMPLETED",
			licenseKey,
			machineId,
			email,
			message: "Thanh toán thành công! Bản quyền đã được kích hoạt.",
		});
	} catch (error) {
		console.error("Capture order error:", error);
		return res.status(500).json({ error: error.message });
	}
}
