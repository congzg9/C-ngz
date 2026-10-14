import crypto from "node:crypto";

const DEFAULT_SECRET = "RECORDLY_PRO_MASTER_SECRET_2026_COMMERCIAL";

function normalizeMachineId(raw) {
	if (!raw) return "";
	let cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
	if (cleaned.startsWith("REC")) cleaned = cleaned.slice(3);
	const parts = cleaned.match(/.{1,4}/g) || [cleaned];
	return `REC-${parts.slice(0, 3).join("-")}`;
}

function generateLicenseKey(machineId, durationDays = 0, secretKey = DEFAULT_SECRET) {
	const normMachineId = normalizeMachineId(machineId);
	if (!normMachineId || normMachineId.length < 8) {
		throw new Error("Mã máy không hợp lệ");
	}

	const expiresAt = durationDays > 0 ? Date.now() + durationDays * 24 * 60 * 60 * 1000 : 0;
	const expiryStr = expiresAt === 0 ? "0" : expiresAt.toString();

	const signature = crypto
		.createHmac("sha256", secretKey)
		.update(`${normMachineId}:${expiryStr}`)
		.digest("hex")
		.substring(0, 8)
		.toUpperCase();

	return {
		licenseKey: `${normMachineId}-${expiryStr}-${signature}`,
		machineId: normMachineId,
		expiresAt: expiresAt === 0 ? null : expiresAt,
	};
}

function getPayPalBaseUrl(env) {
	return env.PAYPAL_MODE === "live"
		? "https://api-m.paypal.com"
		: "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken(env) {
	const clientId = env.PAYPAL_CLIENT_ID;
	const clientSecret = env.PAYPAL_CLIENT_SECRET;
	const baseUrl = getPayPalBaseUrl(env);

	const auth = btoa(`${clientId}:${clientSecret}`);
	const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${auth}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`PayPal auth failed: ${errText}`);
	}

	const data = await res.json();
	return data.access_token;
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
}

async function sendLicenseEmail(env, { toEmail = "giangcong1089@gmail.com", customerName, customerEmail, licenseKey, machineId, price = 35, durationDays = 0, couponCode = null }) {
	const resendKey = env.RESEND_API_KEY;
	if (!resendKey) return;

	const targetEmail = env.ADMIN_EMAIL || "giangcong1089@gmail.com";
	const planText = durationDays === 0 ? "Vĩnh viễn (Trọn đời)" : `${durationDays} ngày`;
	const subject = `🔔 [ĐƠN HÀNG MỚI] Khách vừa mua Record-AutoZoom PRO ($${price} USD)${couponCode ? ` [Mã: ${couponCode}]` : ""}`;
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
      <p style="color: #94a3b8; margin-top: 6px; font-size: 14px;">Hệ thống đã nhận tiền và tự động cấp License Key cho khách.</p>
    </div>

    <table class="info-table">
      <tr>
        <td class="info-label">👤 Khách hàng:</td>
        <td class="info-val">${customerName || "Khách PayPal"}</td>
      </tr>
      <tr>
        <td class="info-label">📧 Email PayPal:</td>
        <td class="info-val" style="color: #38bdf8;">${customerEmail || "—"}</td>
      </tr>
      <tr>
        <td class="info-label">💵 Số tiền thu:</td>
        <td class="info-val" style="color: #34d399; font-size: 16px;">$${price} USD</td>
      </tr>
      ${couponCode ? `<tr><td class="info-label">🎟️ Mã giảm giá dùng:</td><td class="info-val" style="color: #fde68a; font-weight: 700;">${couponCode}</td></tr>` : ""}
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
      Mã này cũng đã được lưu vào hệ thống và hiển thị trực tiếp trên màn hình của khách!
    </p>

    <div class="footer">
      <p>© 2026 Record-AutoZoom Server Notification</p>
    </div>
  </div>
</body>
</html>
	`;

	// 1. Gửi email thông báo cho bạn (Admin)
	try {
		await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${resendKey}`,
			},
			body: JSON.stringify({
				from: env.EMAIL_FROM || "Record-AutoZoom <onboarding@resend.dev>",
				to: [targetEmail],
				subject,
				html,
			}),
		});
	} catch (err) {
		console.warn("Lỗi gửi email Resend cho admin:", err);
	}

	// 2. Tự động gửi email chứa License Key trực tiếp cho khách hàng
	if (customerEmail && customerEmail.includes("@")) {
		try {
			const customerSubject = "🎉 Bản quyền Record-AutoZoom PRO của bạn đã sẵn sàng!";
			const customerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #07050d; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #100c1c; border-radius: 20px; border: 1px solid rgba(168, 85, 247, 0.35); padding: 32px; }
    .header { text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; color: #a855f7; margin: 0; }
    .key-box { background: #07050d; border: 1px solid #7c3aed; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
    .key-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 8px; }
    .key-value { font-family: monospace; font-size: 18px; font-weight: 700; color: #38bdf8; word-break: break-all; }
    .guide-box { background: rgba(255, 255, 255, 0.04); border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">✨ RECORD-AUTOZOOM PRO</h1>
      <p style="color: #94a3b8; margin-top: 6px; font-size: 14px;">Cảm ơn bạn đã mua bản quyền ứng dụng!</p>
    </div>

    <p style="font-size: 15px; margin-top: 20px;">Xin chào <strong>${customerName || "quý khách"}</strong>,</p>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Giao dịch thanh toán bản quyền <strong>${planText}</strong> cho thiết bị <code>${machineId}</code> của bạn đã hoàn tất thành công.</p>

    <div class="key-box">
      <div class="key-label">KHÓA BẢN QUYỀN PRO (LICENSE KEY)</div>
      <div class="key-value">${licenseKey}</div>
    </div>

    <div class="guide-box">
      <strong style="color: #fde68a;">🚀 Hướng dẫn kích hoạt bản quyền:</strong><br>
      1. Mở phần mềm <strong>Record-AutoZoom</strong> trên máy tính.<br>
      2. Bấm vào biểu tượng <strong>Vương Miện (👑)</strong> ở góc trên bên phải.<br>
      3. Dán mã License Key ở trên vào và bấm <strong>Kích hoạt</strong> để bắt đầu sử dụng không giới hạn!
    </div>

    <div class="footer">
      <p>Cần hỗ trợ kỹ thuật? Vui lòng liên hệ giangcong1089@gmail.com</p>
      <p>© 2026 Record-AutoZoom PRO</p>
    </div>
  </div>
</body>
</html>
			`;

			await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${resendKey}`,
				},
				body: JSON.stringify({
					from: env.EMAIL_FROM || "Record-AutoZoom <onboarding@resend.dev>",
					to: [customerEmail],
					subject: customerSubject,
					html: customerHtml,
				}),
			});
		} catch (e) {
			console.warn("Lỗi gửi email cho khách:", e);
		}
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
				},
			});
		}

		// Điều hướng tự động: nếu người dùng mở từ App (có machineId ở trang chủ) thì chuyển sang trang thanh toán /checkout
		if (url.pathname === "/" && url.searchParams.has("machineId")) {
			return Response.redirect(`${url.origin}/checkout${url.search}`, 302);
		}

		// Chặn hoàn toàn đường dẫn admin cũ để đánh lừa bot quét dò
		if (
			url.pathname === "/admin" ||
			url.pathname === "/admin/" ||
			url.pathname === "/admin.html"
		) {
			return new Response("Not Found", { status: 404 });
		}

		const secret = env.LICENSE_SECRET_KEY || DEFAULT_SECRET;
		const clientIP = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
		const rateLimitKey = `ratelimit:admin:${clientIP}`;

		const getPinFromRequest = (req, bodyPin) => {
			return (
				req.headers.get("X-Admin-Pin") ||
				req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
				bodyPin ||
				new URL(req.url).searchParams.get("pin") ||
				""
			).trim();
		};

		const verifyAdminAuth = async (inputPin) => {
			if (env.ORDERS_KV) {
				const attemptsRaw = await env.ORDERS_KV.get(rateLimitKey);
				const attempts = Number(attemptsRaw) || 0;
				if (attempts >= 5) {
					return {
						ok: false,
						status: 429,
						error: "🔒 IP này đã bị khóa tạm thời 15 phút do nhập sai mã PIN quá 5 lần!",
					};
				}
			}

			const p = String(inputPin || "").trim();
			const activePin = (env.ADMIN_PIN || "123Sun321").trim();

			if (p && p === activePin) {
				if (env.ORDERS_KV) {
					await env.ORDERS_KV.delete(rateLimitKey);
				}
				return { ok: true };
			}

			if (env.ORDERS_KV) {
				const attemptsRaw = await env.ORDERS_KV.get(rateLimitKey);
				const nextAttempts = (Number(attemptsRaw) || 0) + 1;
				await env.ORDERS_KV.put(rateLimitKey, String(nextAttempts), { expirationTtl: 900 });
				if (nextAttempts >= 5) {
					return {
						ok: false,
						status: 429,
						error: "🔒 Bạn đã nhập sai mã PIN 5 lần! IP đã bị khóa tạm thời trong 15 phút.",
					};
				}
				return {
					ok: false,
					status: 401,
					error: `Mã PIN không đúng! Bạn còn ${5 - nextAttempts} lần thử trước khi bị khóa tạm thời.`,
				};
			}

			return { ok: false, status: 401, error: "Mã PIN quản trị không đúng" };
		};

		// ─── 1. PAYPAL API ──────────────────────────────────────────
		// POST /api/create-order
		if (url.pathname === "/api/create-order" && request.method === "POST") {
			try {
				const body = await request.json().catch(() => ({}));
				const { machineId, customerEmail, price = "35.00" } = body;

				if (!machineId) {
					return jsonResponse({ error: "Thiếu thông tin Mã máy (Machine ID)" }, 400);
				}

				const accessToken = await getPayPalAccessToken(env);
				const baseUrl = getPayPalBaseUrl(env);

				const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						intent: "CAPTURE",
						purchase_units: [
							{
								amount: {
									currency_code: "USD",
									value: price,
								},
								description: "Record-AutoZoom Desktop PRO",
								custom_id: JSON.stringify({ machineId, customerEmail }),
							},
						],
						application_context: {
							brand_name: "Record-AutoZoom",
							shipping_preference: "NO_SHIPPING",
							user_action: "PAY_NOW",
						},
					}),
				});

				const orderData = await orderRes.json();
				return jsonResponse(orderData, orderRes.status);
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// POST /api/capture-order
		if (url.pathname === "/api/capture-order" && request.method === "POST") {
			try {
				const body = await request.json().catch(() => ({}));
				const { orderId, machineId, customerEmail, durationDays = 0, price = 35, couponCode = null } = body;

				if (!orderId || !machineId) {
					return jsonResponse({ error: "Thiếu orderId hoặc machineId" }, 400);
				}

				const accessToken = await getPayPalAccessToken(env);
				const baseUrl = getPayPalBaseUrl(env);

				const capRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
				});

				const captureData = await capRes.json();
				if (!capRes.ok || captureData.status !== "COMPLETED") {
					return jsonResponse({ error: "Thanh toán chưa hoàn tất", details: captureData }, 400);
				}

				const { licenseKey, machineId: normId, expiresAt } = generateLicenseKey(machineId, Number(durationDays), secret);
				const payer = captureData.payer || {};
				const email = customerEmail || payer.email_address || "PayPal Customer";

				const record = {
					machineId: normId,
					licenseKey,
					orderId,
					customerName: payer.name?.given_name ? `${payer.name.given_name} ${payer.name.surname || ""}`.trim() : email,
					email,
					price: Number(price) || 35,
					currency: "USD",
					couponCode: couponCode || null,
					type: "paypal",
					durationDays: Number(durationDays),
					expiresAt,
					paidAt: Date.now(),
					status: "active",
				};

				if (env.ORDERS_KV) {
					const clean = normId.replace(/[^A-Z0-9]/g, "");
					await env.ORDERS_KV.delete(`revoked:${clean}`);
					await env.ORDERS_KV.put(`lic:${clean}`, JSON.stringify(record));
					await env.ORDERS_KV.put(clean, JSON.stringify(record));
				}

				// Tự động gửi Email thông báo đơn hàng & License Key về hòm thư của bạn
				const mailPromise = sendLicenseEmail(env, {
					toEmail: "giangcong1089@gmail.com",
					customerName: record.customerName,
					customerEmail: email,
					licenseKey,
					machineId: normId,
					price: record.price || 35,
					durationDays: Number(durationDays),
					couponCode: record.couponCode,
				});
				if (ctx && typeof ctx.waitUntil === "function") {
					ctx.waitUntil(mailPromise);
				}

				return jsonResponse({
					success: true,
					status: "COMPLETED",
					licenseKey,
					machineId: normId,
					email,
					message: "Thanh toán thành công! Bản quyền đã được kích hoạt.",
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// POST /api/claim-free (Kích hoạt bản quyền qua coupon giảm giá 100%)
		if (url.pathname === "/api/claim-free" && request.method === "POST") {
			try {
				const body = await request.json().catch(() => ({}));
				const { machineId, couponCode, durationDays = 0 } = body;

				if (!machineId) {
					return jsonResponse({ error: "Thiếu thông tin Mã máy (Machine ID)" }, 400);
				}

				const valid100Codes = ["FREE100", "PRO100", "GIAM100"];
				const codeUpper = (couponCode || "").trim().toUpperCase();
				if (!valid100Codes.includes(codeUpper)) {
					return jsonResponse({ error: "Mã giảm giá không hợp lệ hoặc không áp dụng ưu đãi 100%" }, 400);
				}

				const { licenseKey, machineId: normId, expiresAt } = generateLicenseKey(machineId, Number(durationDays), secret);

				const record = {
					machineId: normId,
					licenseKey,
					orderId: `FREE-${Date.now()}`,
					customerName: `Khách nhận ưu đãi 100% [${codeUpper}]`,
					email: "free-coupon@record-autozoom.app",
					price: 0,
					currency: "USD",
					couponCode: codeUpper,
					type: "free_coupon",
					durationDays: Number(durationDays),
					expiresAt,
					paidAt: Date.now(),
					status: "active",
				};

				if (env.ORDERS_KV) {
					const clean = normId.replace(/[^A-Z0-9]/g, "");
					await env.ORDERS_KV.delete(`revoked:${clean}`);
					await env.ORDERS_KV.put(`lic:${clean}`, JSON.stringify(record));
					await env.ORDERS_KV.put(clean, JSON.stringify(record));
				}

				// Gửi email thông báo đơn kích hoạt miễn phí 100% cho quản trị viên
				const mailPromise = sendLicenseEmail(env, {
					toEmail: "giangcong1089@gmail.com",
					customerName: `Khách mã 100% (${codeUpper})`,
					customerEmail: "free-coupon@record-autozoom.app",
					licenseKey,
					machineId: normId,
					price: 0,
					durationDays: Number(durationDays),
					couponCode: codeUpper,
				});
				if (ctx && typeof ctx.waitUntil === "function") {
					ctx.waitUntil(mailPromise);
				}

				return jsonResponse({
					success: true,
					status: "COMPLETED",
					licenseKey,
					machineId: normId,
					message: "Kích hoạt bản quyền miễn phí 100% thành công!",
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ─── 2. SEPAY WEBHOOK (TECHCOMBANK TỰ ĐỘNG) ─────────────────
		if (url.pathname === "/api/sepay-webhook" && request.method === "POST") {
			try {
				const body = await request.json().catch(() => ({}));
				const { content, transferAmount, transferType } = body;

				if (transferType !== "in" && transferType !== "IN") {
					return jsonResponse({ message: "Bỏ qua giao dịch không phải tiền vào" });
				}

				const amount = Number(transferAmount) || 0;
				if (amount < 100000) {
					return jsonResponse({ message: "Số tiền nhỏ hơn gói cước tối thiểu" });
				}

				const rawContent = (content || "").toUpperCase();
				const match = rawContent.match(/REC[-_\s]?([A-Z0-9]{8,16})/);
				let rawMachineId = match ? match[0] : "";
				if (!rawMachineId) {
					const hexMatch = rawContent.match(/[A-F0-9]{12,16}/);
					if (hexMatch) rawMachineId = hexMatch[0];
				}

				if (!rawMachineId) {
					return jsonResponse({ message: "Không tìm thấy Machine ID trong nội dung CK", content });
				}

				const durationDays = amount >= 700000 ? 0 : 30;
				const { licenseKey, machineId: normId, expiresAt } = generateLicenseKey(rawMachineId, durationDays, secret);

				const record = {
					machineId: normId,
					licenseKey,
					customerName: "Khách VietQR",
					amount,
					price: amount,
					currency: "VND",
					type: "vietqr",
					durationDays,
					expiresAt,
					paidAt: Date.now(),
					status: "active",
				};

				if (env.ORDERS_KV) {
					const clean = normId.replace(/[^A-Z0-9]/g, "");
					await env.ORDERS_KV.put(`lic:${clean}`, JSON.stringify(record));
					await env.ORDERS_KV.put(clean, JSON.stringify(record));
				}

				return jsonResponse({
					success: true,
					message: "Đã tạo license key thành công cho SePAY",
					licenseKey,
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// GET /api/check-payment (Polling kiểm tra chuyển khoản)
		if (url.pathname === "/api/check-payment" && request.method === "GET") {
			const machineId = url.searchParams.get("machineId");
			if (!machineId) return jsonResponse({ error: "Thiếu machineId" }, 400);

			const normId = normalizeMachineId(machineId);
			const clean = normId.replace(/[^A-Z0-9]/g, "");

			if (env.ORDERS_KV) {
				let dataStr = await env.ORDERS_KV.get(`lic:${clean}`);
				if (!dataStr) dataStr = await env.ORDERS_KV.get(clean);
				if (dataStr) {
					const data = JSON.parse(dataStr);
					return jsonResponse({
						paid: true,
						licenseKey: data.licenseKey,
						message: "Giao dịch đã hoàn tất!",
					});
				}
			}

			return jsonResponse({ paid: false, message: "Đang chờ thanh toán..." });
		}

		// GET /api/verify-license (Kiểm tra trạng thái bản quyền & thu hồi từ xa)
		if (url.pathname === "/api/verify-license" && request.method === "GET") {
			const machineId = url.searchParams.get("machineId");
			const key = url.searchParams.get("key");
			if (!machineId) return jsonResponse({ error: "Thiếu machineId" }, 400);

			const normId = normalizeMachineId(machineId);
			const clean = normId.replace(/[^A-Z0-9]/g, "");

			if (env.ORDERS_KV) {
				// 1. Kiểm tra danh sách đã bị thu hồi / xóa
				const isRevoked = await env.ORDERS_KV.get(`revoked:${clean}`);
				if (isRevoked) {
					return jsonResponse({
						valid: false,
						revoked: true,
						message: "Bản quyền trên thiết bị này đã bị Quản trị viên thu hồi!",
					});
				}

				// 2. Kiểm tra xem bản ghi còn tồn tại không
				let dataStr = await env.ORDERS_KV.get(`lic:${clean}`);
				if (!dataStr) dataStr = await env.ORDERS_KV.get(clean);

				if (!dataStr) {
					return jsonResponse({
						valid: false,
						revoked: true,
						message: "Bản quyền không còn tồn tại trên hệ thống hoặc đã bị xóa!",
					});
				}

				const data = JSON.parse(dataStr);
				if (data.status === "revoked" || data.status === "disabled") {
					return jsonResponse({
						valid: false,
						revoked: true,
						message: "Khóa bản quyền đã bị vô hiệu hóa bởi Quản trị viên!",
					});
				}

				if (key && data.licenseKey && key.trim() !== data.licenseKey.trim()) {
					return jsonResponse({
						valid: false,
						revoked: true,
						message: "Mã kích hoạt không khớp với bản quyền đã đăng ký trên hệ thống!",
					});
				}

				return jsonResponse({
					valid: true,
					status: "active",
					expiresAt: data.expiresAt || null,
					message: "Bản quyền hợp lệ và đang hoạt động.",
				});
			}

			return jsonResponse({ valid: true, status: "active" });
		}

		// ─── 2.5 TRIAL ANTI-ABUSE API (CHỐNG GIAN LẬN XÓA TẢI LẠI) ──
		// GET /api/trial/check?machineId=...
		if (url.pathname === "/api/trial/check" && request.method === "GET") {
			const rawMachineId = url.searchParams.get("machineId");
			if (!rawMachineId) return jsonResponse({ used: 0, limit: 5 });
			const clean = rawMachineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
			if (env.ORDERS_KV) {
				try {
					const trialData = await env.ORDERS_KV.get(`trial:${clean}`);
					if (trialData) {
						const parsed = JSON.parse(trialData);
						return jsonResponse({ used: Number(parsed.used) || 0, limit: 5 });
					}
				} catch (_) {}
			}
			return jsonResponse({ used: 0, limit: 5 });
		}

		// POST /api/trial/sync
		if (url.pathname === "/api/trial/sync" && request.method === "POST") {
			try {
				const body = await request.json().catch(() => ({}));
				const { machineId, used = 0 } = body;
				if (!machineId) return jsonResponse({ error: "Missing machineId" }, 400);
				const clean = machineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
				let currentUsed = Number(used) || 0;
				if (env.ORDERS_KV) {
					try {
						const existingStr = await env.ORDERS_KV.get(`trial:${clean}`);
						if (existingStr) {
							const existing = JSON.parse(existingStr);
							currentUsed = Math.max(currentUsed, Number(existing.used) || 0);
						}
						await env.ORDERS_KV.put(
							`trial:${clean}`,
							JSON.stringify({ used: currentUsed, updatedAt: Date.now() })
						);
					} catch (_) {}
				}
				return jsonResponse({ success: true, used: currentUsed, limit: 5 });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// ─── 3. ADMIN API ───────────────────────────────────────────
		// GET /api/admin/keys
		if (url.pathname === "/api/admin/keys" && request.method === "GET") {
			const pin = getPinFromRequest(request);
			const auth = await verifyAdminAuth(pin);
			if (!auth.ok) {
				return jsonResponse({ error: auth.error }, auth.status || 401);
			}

			const map = new Map();
			if (env.ORDERS_KV) {
				try {
					const listRes = await env.ORDERS_KV.list({ limit: 1000 });
					const keys = listRes.keys || [];
					for (const k of keys) {
						if (k.name.startsWith("revoked:") || k.name.startsWith("ratelimit:")) continue;
						try {
							const val = await env.ORDERS_KV.get(k.name);
							if (val) {
								const parsed = JSON.parse(val);
								const mId = parsed.machineId || k.name;
								if (!map.has(mId) || k.name.startsWith("lic:")) {
									parsed._kvKey = k.name;
									map.set(mId, parsed);
								}
							}
						} catch (e) {
							// skip
						}
					}
				} catch (err) {
					console.error("Lỗi đọc KV:", err);
				}
			}

			const list = Array.from(map.values());
			list.sort((a, b) => (b.createdAt || b.paidAt || 0) - (a.createdAt || a.paidAt || 0));
			return jsonResponse({ success: true, keys: list });
		}

		// POST /api/admin/create-key
		if (url.pathname === "/api/admin/create-key" && request.method === "POST") {
			try {
				const body = await request.json().catch(() => ({}));
				const { machineId, customerName = "", note = "", durationDays = 0, price = 0 } = body;
				const pin = getPinFromRequest(request, body.pin);

				const auth = await verifyAdminAuth(pin);
				if (!auth.ok) {
					return jsonResponse({ error: auth.error }, auth.status || 401);
				}

				if (!machineId) {
					return jsonResponse({ error: "Vui lòng nhập Mã máy (Machine ID)" }, 400);
				}

				const { licenseKey, machineId: normId, expiresAt } = generateLicenseKey(machineId, Number(durationDays), secret);

				const cleanKeyName = `lic:${normId.replace(/[^A-Z0-9]/g, "")}`;
				const clean = normId.replace(/[^A-Z0-9]/g, "");
				const record = {
					machineId: normId,
					licenseKey,
					customerName: customerName.trim() || "Khách hàng",
					note: note.trim(),
					durationDays: Number(durationDays),
					expiresAt,
					price: Number(price) || 0,
					createdAt: Date.now(),
					status: "active",
				};

				if (env.ORDERS_KV) {
					// Xóa khỏi danh sách thu hồi nếu có
					await env.ORDERS_KV.delete(`revoked:${clean}`);
					await env.ORDERS_KV.put(cleanKeyName, JSON.stringify(record));
					await env.ORDERS_KV.put(clean, JSON.stringify(record));
				}

				return jsonResponse({
					success: true,
					message: "Cấp khóa bản quyền thành công!",
					data: record,
				});
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// POST /api/admin/delete-key
		if (url.pathname === "/api/admin/delete-key" && request.method === "POST") {
			try {
				const body = await request.json().catch(() => ({}));
				const { machineId, kvKey } = body;
				const pin = getPinFromRequest(request, body.pin);

				const auth = await verifyAdminAuth(pin);
				if (!auth.ok) {
					return jsonResponse({ error: auth.error }, auth.status || 401);
				}

				if (env.ORDERS_KV) {
					let targetClean = "";
					if (machineId) {
						targetClean = machineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
					} else if (kvKey) {
						targetClean = kvKey.replace(/^lic:/, "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
					}

					if (targetClean) {
						// Đánh dấu thu hồi trên Cloudflare KV (lưu 1 năm)
						await env.ORDERS_KV.put(`revoked:${targetClean}`, JSON.stringify({
							revokedAt: Date.now(),
							machineId: targetClean,
							reason: "Deleted by admin"
						}), { expirationTtl: 31536000 });

						await env.ORDERS_KV.delete(`lic:${targetClean}`);
						await env.ORDERS_KV.delete(targetClean);
					}
					if (kvKey) await env.ORDERS_KV.delete(kvKey);
				}

				return jsonResponse({ success: true, message: "Đã xóa bản quyền và kích hoạt lệnh thu hồi từ xa!" });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		// Phục vụ frontend tĩnh (HTML/CSS/JS)
		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		return new Response("Not Found", { status: 404 });
	},
};
