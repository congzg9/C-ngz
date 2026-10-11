import path from "node:path";
import { app } from "electron";

const hasApp = typeof app !== "undefined" && typeof app?.getPath === "function";

if (hasApp && process.env["VITE_DEV_SERVER_URL"]) {
	const devUserDataPath = path.join(app.getPath("appData"), "Recordly-dev");
	app.setPath("userData", devUserDataPath);
	app.setPath("sessionData", path.join(devUserDataPath, "session"));
}

export const USER_DATA_PATH = hasApp ? app.getPath("userData") : "";
export const RECORDINGS_DIR = USER_DATA_PATH ? path.join(USER_DATA_PATH, "recordings") : "";
