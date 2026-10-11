import { completedOrders } from "./sepay-webhook.js";

export default async function handler(req, res) {
	const url = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
	const rawMachineId = url.searchParams.get("machineId") || "";

	if (!rawMachineId) {
		return res.status(400).json({ error: "Thiếu machineId" });
	}

	const cleanId = rawMachineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
	
	// Tra cứu trong completedOrders
	const orders = global.completedOrders || completedOrders;
	let found = null;

	if (orders) {
		for (const [key, order] of orders.entries()) {
			const cleanKey = key.replace(/[^A-Z0-9]/g, "");
			if (cleanKey.includes(cleanId) || cleanId.includes(cleanKey)) {
				found = order;
				break;
			}
		}
	}

	if (found) {
		return res.status(200).json({
			paid: true,
			licenseKey: found.licenseKey,
			machineId: found.machineId,
			amount: found.amount,
			planName: found.planName,
		});
	}

	return res.status(200).json({
		paid: false,
		message: "Đang chờ thanh toán...",
	});
}
