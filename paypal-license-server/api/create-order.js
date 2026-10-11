import { getPayPalAccessToken, getPayPalBaseUrl } from "../lib/paypal-client.js";

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { machineId, customerEmail, price = "29.00" } = req.body || {};

		if (!machineId) {
			return res.status(400).json({ error: "Thiếu thông tin Mã máy (Machine ID)" });
		}

		const accessToken = await getPayPalAccessToken();
		const baseUrl = getPayPalBaseUrl();

		const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
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
						description: "Recordly Desktop PRO (Lifetime License)",
						custom_id: JSON.stringify({ machineId, customerEmail }),
					},
				],
				application_context: {
					brand_name: "Recordly Desktop",
					shipping_preference: "NO_SHIPPING",
					user_action: "PAY_NOW",
				},
			}),
		});

		const order = await response.json();
		return res.status(response.status).json(order);
	} catch (error) {
		console.error("Create order error:", error);
		return res.status(500).json({ error: error.message });
	}
}
