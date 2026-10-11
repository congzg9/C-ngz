export function getPayPalBaseUrl() {
	return process.env.PAYPAL_MODE === "live"
		? "https://api-m.paypal.com"
		: "https://api-m.sandbox.paypal.com";
}

/**
 * Lấy Access Token từ PayPal Client ID và Client Secret
 */
export async function getPayPalAccessToken() {
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
	const baseUrl = getPayPalBaseUrl();

	if (!clientId || !clientSecret) {
		throw new Error("Chưa cấu hình PAYPAL_CLIENT_ID hoặc PAYPAL_CLIENT_SECRET");
	}

	const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
	const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${auth}`,
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: "grant_type=client_credentials",
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Lỗi xác thực PayPal: ${errText}`);
	}

	const data = await response.json();
	return data.access_token;
}
