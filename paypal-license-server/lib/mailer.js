/**
 * Gửi email tự động chứa License Key cho khách hàng
 */
export async function sendLicenseEmail({ toEmail, customerName, licenseKey, machineId }) {
	const subject = "🎉 Bản quyền Record Auto-Zoom PRO của bạn đã sẵn sàng!";
	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; color: #38bdf8; margin: 0; }
    .key-box { background: #0f172a; border: 1px solid #0284c7; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
    .key-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px; }
    .key-value { font-family: monospace; font-size: 18px; font-weight: bold; color: #38bdf8; word-break: break-all; user-select: all; }
    .steps { background: #0f172a; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .steps ol { margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.6; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; pt: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Record Auto-Zoom PRO</h1>
      <p style="color: #94a3b8; margin-top: 6px; font-size: 14px;">Cảm ơn bạn đã mua bản quyền Record Auto-Zoom!</p>
    </div>

    <p style="color: #e2e8f0; font-size: 15px; margin-top: 24px;">Xin chào <strong>${customerName || "bạn"}</strong>,</p>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">Giao dịch thanh toán qua PayPal của bạn đã hoàn tất thành công. Dưới đây là Mã kích hoạt bản quyền Vĩnh viễn (Lifetime) dành riêng cho thiết bị của bạn:</p>

    <div class="key-box">
      <div class="key-label">MÃ KÍCH HOẠT (LICENSE KEY)</div>
      <div class="key-value">${licenseKey}</div>
    </div>

    <div class="steps">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #f1f5f9; font-size: 14px;">Hướng dẫn kích hoạt trong 3 bước:</p>
      <ol>
        <li>Mở ứng dụng <strong>Record Auto-Zoom</strong> trên máy tính của bạn.</li>
        <li>Bấm vào nút <strong>"KÍCH HOẠT PRO"</strong> trên thanh tiêu đề trên cùng.</li>
        <li>Dán mã kích hoạt ở trên vào ô <strong>License Key</strong> rồi bấm <strong>"Kích hoạt ngay"</strong>.</li>
      </ol>
    </div>

    <p style="color: #94a3b8; font-size: 13px;">Thiết bị đã gắn mã: <code>${machineId}</code></p>

    <div class="footer">
      <p>© 2026 Record Auto-Zoom. Nếu cần hỗ trợ, vui lòng phản hồi trực tiếp email này.</p>
    </div>
  </div>
</body>
</html>
	`;

	// 1. Nếu có cấu hình RESEND_API_KEY
	if (process.env.RESEND_API_KEY) {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
			},
			body: JSON.stringify({
				from: process.env.EMAIL_FROM || "Record Auto-Zoom <onboarding@resend.dev>",
				to: toEmail.trim().toLowerCase(),
				subject,
				html: htmlContent,
			}),
		});
		return res.json();
	}

	// 2. Nếu có cấu hình GMAIL SMTP (Dùng email Gmail của bạn)
	if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
		try {
			const { default: nodemailer } = await import("nodemailer");
			const transporter = nodemailer.createTransport({
				service: "gmail",
				auth: {
					user: process.env.GMAIL_USER,
					pass: process.env.GMAIL_APP_PASSWORD,
				},
			});

			return await transporter.sendMail({
				from: `"Record Auto-Zoom PRO" <${process.env.GMAIL_USER}>`,
				to: toEmail,
				subject,
				html: htmlContent,
			});
		} catch (e) {
			console.warn("Không thể gửi qua Gmail SMTP (cần cài đặt nodemailer nếu dùng tính năng này):", e.message);
		}
	}

	console.log(`[DEV MODE] Giả lập gửi mail tới ${toEmail} thành công! Key: ${licenseKey}`);
	return { simulated: true, to: toEmail };
}
