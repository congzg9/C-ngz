import fs from "fs";

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

async function sendAdminNotificationTest() {
	const resendKey = process.env.RESEND_API_KEY;
	if (!resendKey) {
		console.log("Thiếu RESEND_API_KEY");
		return;
	}

	const targetEmail = "giangcong1089@gmail.com";
	const price = 35;
	const durationDays = 30;
	const planText = `${durationDays} ngày (Gói Tháng)`;
	const machineId = "REC-8F92-4A1C-9B3D";
	const licenseKey = "REC-8F92-4A1C-9B3D-1794236231609-34B34CE1";
	const customerName = "John Doe (United States)";
	const customerEmail = "customer_paypal@example.com";

	const subject = `🔔 [ĐƠN HÀNG MỚI] Khách vừa mua Record Auto-Zoom PRO ($${price} USD)`;
	const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #07050d; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #100c1c; border-radius: 20px; border: 1px solid rgba(168, 85, 247, 0.35); padding: 32px; }
    .header { text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; color: #34d399; margin: 0; }
    .key-box { background: #07050d; border: 1px solid #7c3aed; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
    .key-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 8px; }
    .key-value { font-family: monospace; font-size: 18px; font-weight: 700; color: #38bdf8; word-break: break-all; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
    .info-table td { padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
    .info-label { color: #94a3b8; width: 35%; font-weight: 600; }
    .info-val { color: #fff; font-weight: 600; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">🎉 CÓ ĐƠN HÀNG MỚI TỪ PAYPAL!</h1>
      <p style="color: #94a3b8; margin-top: 6px; font-size: 14px;">Hệ thống đã nhận tiền PayPal và tự động cấp License Key cho khách.</p>
    </div>

    <table class="info-table">
      <tr>
        <td class="info-label">👤 Khách hàng:</td>
        <td class="info-val">${customerName}</td>
      </tr>
      <tr>
        <td class="info-label">📧 Email PayPal:</td>
        <td class="info-val" style="color: #38bdf8;">${customerEmail}</td>
      </tr>
      <tr>
        <td class="info-label">💵 Số tiền thu:</td>
        <td class="info-val" style="color: #34d399; font-size: 16px;">$${price} USD</td>
      </tr>
      <tr>
        <td class="info-label">📦 Gói bản quyền:</td>
        <td class="info-val">${planText}</td>
      </tr>
      <tr>
        <td class="info-label">💻 Mã máy (Machine ID):</td>
        <td class="info-val" style="font-family: monospace; color: #cbd5e1;">${machineId}</td>
      </tr>
    </table>

    <div class="key-box">
      <div class="key-label">MÃ LICENSE KEY ĐÃ CẤP CHO MÁY NÀY</div>
      <div class="key-value">${licenseKey}</div>
    </div>

    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 12px;">
      Mã này đã được lưu vào hệ thống và hiển thị trực tiếp trên màn hình của khách!
    </p>

    <div class="footer">
      <p>© 2026 Record Auto-Zoom Server Notification</p>
    </div>
  </div>
</body>
</html>
	`;

	console.log(`- Đang gửi email thông báo đơn hàng Admin đến: ${targetEmail}...`);
	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${resendKey}`,
		},
		body: JSON.stringify({
			from: "Record Auto-Zoom <onboarding@resend.dev>",
			to: [targetEmail],
			subject,
			html,
		}),
	});

	const data = await res.json();
	console.log("📬 Phản hồi:", data);
	if (data.id) {
		console.log("🎉 ĐÃ GỬI THÀNH CÔNG EMAIL THÔNG BÁO ĐƠN HÀNG ADMIN!");
	}
}

sendAdminNotificationTest();
