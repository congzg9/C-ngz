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

export default {
	async fetch(request, env) {
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

		const secret = env.LICENSE_SECRET_KEY || DEFAULT_SECRET;
		const checkAdminPin = (inputPin) => {
			if (!inputPin) return false;
			const p = String(inputPin).trim();
			if (env.ADMIN_PIN && p === env.ADMIN_PIN) return true;
			return p === "888888" || p === "88888888" || p === "cong123";
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
								description: "Record Auto-Zoom Desktop PRO",
								custom_id: JSON.stringify({ machineId, customerEmail }),
							},
						],
						application_context: {
							brand_name: "Record Auto-Zoom",
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
				const { orderId, machineId, customerEmail, durationDays = 0, price = 35 } = body;

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
					type: "paypal",
					durationDays: Number(durationDays),
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
			const pin = url.searchParams.get("pin");
			if (!checkAdminPin(pin)) {
				return jsonResponse({ error: "Mã PIN quản trị không đúng" }, 401);
			}

			const map = new Map();
			if (env.ORDERS_KV) {
				try {
					const listRes = await env.ORDERS_KV.list({ limit: 1000 });
					const keys = listRes.keys || [];
					for (const k of keys) {
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
				const { pin, machineId, customerName = "", note = "", durationDays = 0, price = 0 } = body;

				if (!checkAdminPin(pin)) {
					return jsonResponse({ error: "Mã PIN quản trị không đúng" }, 401);
				}

				if (!machineId) {
					return jsonResponse({ error: "Vui lòng nhập Mã máy (Machine ID)" }, 400);
				}

				const { licenseKey, machineId: normId, expiresAt } = generateLicenseKey(machineId, Number(durationDays), secret);

				const cleanKeyName = `lic:${normId.replace(/[^A-Z0-9]/g, "")}`;
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
					await env.ORDERS_KV.put(cleanKeyName, JSON.stringify(record));
					await env.ORDERS_KV.put(normId.replace(/[^A-Z0-9]/g, ""), JSON.stringify(record));
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
				const { pin, machineId, kvKey } = body;

				if (!checkAdminPin(pin)) {
					return jsonResponse({ error: "Mã PIN quản trị không đúng" }, 401);
				}

				if (env.ORDERS_KV) {
					if (kvKey) await env.ORDERS_KV.delete(kvKey);
					if (machineId) {
						const clean = machineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
						await env.ORDERS_KV.delete(`lic:${clean}`);
						await env.ORDERS_KV.delete(clean);
					}
				}

				return jsonResponse({ success: true, message: "Đã xóa bản ghi thành công!" });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		return new Response("Not Found", { status: 404 });
	},
};
