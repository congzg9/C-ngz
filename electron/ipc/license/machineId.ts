import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { USER_DATA_PATH } from "../../appPaths";

const MACHINE_ID_FILE = path.join(USER_DATA_PATH, "machine-id.json");

/**
 * Generate a consistent, stable, unique hardware-based Machine ID.
 */
function computeHardwareSignature(): string {
	const parts: string[] = [];
	try {
		parts.push(os.hostname() || "unknown-host");
		parts.push(os.arch() || "unknown-arch");
		parts.push(os.platform() || "unknown-platform");
		parts.push(os.userInfo().username || "unknown-user");
		const cpus = os.cpus();
		if (cpus && cpus.length > 0) {
			parts.push(cpus[0].model);
		}
		const networkInterfaces = os.networkInterfaces();
		for (const ifaceName of Object.keys(networkInterfaces)) {
			const interfaces = networkInterfaces[ifaceName];
			if (interfaces) {
				for (const iface of interfaces) {
					if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
						parts.push(iface.mac);
						break;
					}
				}
			}
		}
	} catch {
		parts.push(crypto.randomUUID());
	}

	const hash = crypto.createHash("sha256").update(parts.join("|")).digest("hex").toUpperCase();
	// Format: REC-XXXX-XXXX-XXXX
	return `REC-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
}

let cachedMachineId: string | null = null;

export async function getOrCreateMachineId(): Promise<string> {
	if (cachedMachineId) {
		return cachedMachineId;
	}

	try {
		if (existsSync(MACHINE_ID_FILE)) {
			const content = await fs.readFile(MACHINE_ID_FILE, "utf-8");
			const parsed = JSON.parse(content);
			if (parsed.machineId && typeof parsed.machineId === "string" && parsed.machineId.startsWith("REC-")) {
				cachedMachineId = parsed.machineId as string;
				return cachedMachineId;
			}
		}
	} catch {
		// fallback to compute
	}

	const newId = computeHardwareSignature();
	cachedMachineId = newId;

	try {
		await fs.mkdir(path.dirname(MACHINE_ID_FILE), { recursive: true });
		await fs.writeFile(MACHINE_ID_FILE, JSON.stringify({ machineId: newId, createdAt: Date.now() }, null, 2), "utf-8");
	} catch (err) {
		console.warn("Could not persist machine ID:", err);
	}

	return newId;
}
