import { generateLicenseKey } from "../lib/keygen.js";
import { sendLicenseEmail } from "../lib/mailer.js";

// Bộ nhớ tạm lưu các giao dịch thành công theo Machine ID
// (Trong môi trường production có thể lưu vào file hoặc DB)
const completedOrders = global.completedOrders || new Map();
global.completedOrders = completedOrders;

export { completedOrders };

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const payload = req.body || {};
		console.log("🔔 [SePAY Webhook] Nhận thông báo biến động số dư:", payload);

		// Kiểm tra giao dịch tiền vào (transferType = "in")
		const {
			transferType,
			transferAmount,
			content,
			description,
			accountNumber,
		} = payload;

		if (transferType !== "in" && transferType !== undefined) {
			return res.status(200).json({ success: true, message: "Bỏ qua giao dịch tiền ra" });
		}

		const fullContent = `${content || ""} ${description || ""}`.toUpperCase();
		const amount = Number(transferAmount) || 0;

		// Trích xuất mã máy từ nội dung chuyển khoản: ví dụ "REC 8F924A1C9B3D" hoặc "REC VV 8F924A1C9B3D"
		const match = fullContent.match(/REC(?:\s*(?:1T|VV))?\s*([A-Z0-9]{8,16})/i);
		
		if (!match || !match[1]) {
			console.warn("⚠️ Không tìm thấy Mã máy trong nội dung chuyển khoản:", fullContent);
			return res.status(200).json({
				success: false,
				message: "Không tìm thấy Mã máy trong nội dung",
			});
		}

		const rawMachineId = match[1];
		// Format chuẩn mã máy: REC-XXXX-XXXX-XXXX
		const parts = rawMachineId.match(/.{1,4}/g) || [rawMachineId];
		const formattedMachineId = `REC-${parts.join("-")}`;

		// Xác định thời hạn theo số tiền:
		// >= 700.000đ: Gói Vĩnh viễn (0)
		// < 700.000đ: Gói 1 Tháng (30 ngày)
		const durationDays = amount >= 700000 ? 0 : 30;
		const planName = durationDays === 0 ? "Vĩnh viễn (Lifetime)" : "1 Tháng (30 ngày)";

		// Tự động sinh License Key
		const licenseKey = generateLicenseKey(formattedMachineId, durationDays);

		// Lưu kết quả vào bộ nhớ để trang web của khách tự động lấy key
		const orderResult = {
			success: true,
			machineId: formattedMachineId,
			licenseKey,
			amount,
			planName,
			paidAt: Date.now(),
		};

		completedOrders.set(formattedMachineId, orderResult);
		// Cũng lưu theo dạng thô để dễ tra cứu
		completedOrders.set(rawMachineId, orderResult);

		console.log(`🎉 [SePAY] KÍCH HOẠT THÀNH CÔNG cho máy ${formattedMachineId}! Key: ${licenseKey}`);

		return res.status(200).json({
			success: true,
			message: "Xử lý kích hoạt SePAY thành công",
			data: orderResult,
		});
	} catch (error) {
		console.error("SePAY Webhook Error:", error);
		return res.status(500).json({ error: error.message });
	}
}
