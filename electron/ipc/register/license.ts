import { BrowserWindow, dialog, ipcMain } from "electron";
import { getOrCreateMachineId } from "../license/machineId";
import {
	activateLicense,
	deactivateLicense,
	getLicenseStatus,
	getRecordingUsage,
	checkCanRecord,
	consumeRecording,
	checkOnlineLicenseRevocation,
} from "../license/licenseService";

let revocationWatcherStarted = false;

function startRevocationWatcher() {
	if (revocationWatcherStarted) return;
	revocationWatcherStarted = true;

	const performCheck = async () => {
		try {
			const status = await getLicenseStatus();
			if (status.isPro && status.key) {
				const check = await checkOnlineLicenseRevocation(status.machineId, status.key);
				if (check.revoked) {
					console.warn("[RevocationWatcher] License has been deleted/revoked by admin!");
					// Broadcast to all windows
					for (const win of BrowserWindow.getAllWindows()) {
						if (!win.isDestroyed()) {
							win.webContents.send("license-revoked", {
								message: check.reason || "Bản quyền của bạn đã bị xóa bởi Quản trị viên.",
							});
						}
					}
					// Show warning dialog
					dialog.showMessageBox({
						type: "warning",
						title: "Bản quyền đã bị thu hồi",
						message: check.reason || "Bản quyền Recordly PRO trên thiết bị này đã bị xóa hoặc thu hồi bởi Quản trị viên.",
						buttons: ["Đã hiểu"],
					}).catch(() => {});
				}
			}
		} catch {
			// ignore network errors
		}
	};

	// Check initially after 5 seconds
	setTimeout(performCheck, 5000);
	// Check every 2.5 minutes
	setInterval(performCheck, 150000);
}

export function registerLicenseHandlers() {
	ipcMain.handle("get-machine-id", async () => {
		return await getOrCreateMachineId();
	});

	ipcMain.handle("get-license-status", async (_event, forceCheckOnline?: boolean) => {
		return await getLicenseStatus(Boolean(forceCheckOnline));
	});

	ipcMain.handle("activate-license", async (_event, key: string, email?: string) => {
		return await activateLicense(key, email);
	});

	ipcMain.handle("deactivate-license", async () => {
		return await deactivateLicense();
	});

	ipcMain.handle("get-recording-usage", async () => {
		return await getRecordingUsage();
	});

	ipcMain.handle("check-can-record", async (_event, params?: { quality?: string; width?: number; height?: number; format?: string }) => {
		return await checkCanRecord(params);
	});

	ipcMain.handle("consume-recording", async () => {
		return await consumeRecording();
	});

	startRevocationWatcher();
}
