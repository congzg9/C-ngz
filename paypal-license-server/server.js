import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import createOrderHandler from "./api/create-order.js";
import captureOrderHandler from "./api/capture-order.js";
import claimFreeHandler from "./api/claim-free.js";
import sepayWebhookHandler from "./api/sepay-webhook.js";
import checkPaymentHandler from "./api/check-payment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tự động nạp .env nếu có
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
	const envLines = fs.readFileSync(envPath, "utf-8").split("\n");
	for (const line of envLines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const [key, ...vals] = trimmed.split("=");
		if (key && vals.length > 0) {
			process.env[key.trim()] = vals.join("=").trim();
		}
	}
}

const PORT = process.env.PORT || 3000;

function parseJsonBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => { body += chunk; });
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch (e) {
				reject(e);
			}
		});
		req.on("error", reject);
	});
}

const server = http.createServer(async (req, res) => {
	// CORS headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	const url = new URL(req.url, `http://${req.headers.host}`);

	// Helper response
	const customRes = {
		status(code) {
			res.statusCode = code;
			return this;
		},
		json(data) {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(data));
		},
	};

	try {
		if (url.pathname === "/api/create-order" && req.method === "POST") {
			req.body = await parseJsonBody(req);
			return await createOrderHandler(req, customRes);
		}

		if (url.pathname === "/api/capture-order" && req.method === "POST") {
			req.body = await parseJsonBody(req);
			return await captureOrderHandler(req, customRes);
		}

		if (url.pathname === "/api/claim-free" && req.method === "POST") {
			req.body = await parseJsonBody(req);
			return await claimFreeHandler(req, customRes);
		}

		if (url.pathname === "/api/sepay-webhook" && req.method === "POST") {
			req.body = await parseJsonBody(req);
			return await sepayWebhookHandler(req, customRes);
		}

		if (url.pathname === "/api/check-payment" && req.method === "GET") {
			return await checkPaymentHandler(req, customRes);
		}

		// Phục vụ file tĩnh trong /public
		let filePath = path.join(__dirname, "public", url.pathname === "/" ? "index.html" : url.pathname);
		if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
			const ext = path.extname(filePath);
			const contentType = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : "application/javascript";
			res.writeHead(200, { "Content-Type": contentType });
			fs.createReadStream(filePath).pipe(res);
			return;
		}

		res.writeHead(404);
		res.end("Not Found");
	} catch (err) {
		console.error("Server error:", err);
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: err.message }));
	}
});

server.listen(PORT, () => {
	console.log(`🚀 Recordly PayPal Server đang chạy tại http://localhost:${PORT}`);
});
