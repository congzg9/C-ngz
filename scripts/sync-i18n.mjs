import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const localesDir = path.join(root, "src", "i18n", "locales");
const baseLocaleDir = path.join(localesDir, "en");

const locales = fs
	.readdirSync(localesDir)
	.filter((entry) => {
		const fullPath = path.join(localesDir, entry);
		return fs.statSync(fullPath).isDirectory() && entry !== "en";
	});

const namespaceFiles = fs
	.readdirSync(baseLocaleDir)
	.filter((file) => file.endsWith(".json"));

function syncObjects(base, target) {
	if (typeof base !== "object" || base === null || Array.isArray(base)) {
		return target !== undefined ? target : base;
	}

	const result = typeof target === "object" && target !== null && !Array.isArray(target)
		? { ...target }
		: {};

	// Add missing keys from base
	for (const key of Object.keys(base)) {
		if (result[key] === undefined) {
			result[key] = base[key];
		} else {
			result[key] = syncObjects(base[key], result[key]);
		}
	}

	// Remove extra keys not in base
	for (const key of Object.keys(result)) {
		if (base[key] === undefined) {
			delete result[key];
		}
	}

	return result;
}

for (const namespaceFile of namespaceFiles) {
	const baseData = JSON.parse(fs.readFileSync(path.join(baseLocaleDir, namespaceFile), "utf8"));

	for (const locale of locales) {
		const targetPath = path.join(localesDir, locale, namespaceFile);
		let targetData = {};
		if (fs.existsSync(targetPath)) {
			try {
				targetData = JSON.parse(fs.readFileSync(targetPath, "utf8"));
			} catch (e) {
				console.error(`Failed to read ${targetPath}:`, e);
			}
		}
		const synchronized = syncObjects(baseData, targetData);
		fs.writeFileSync(targetPath, JSON.stringify(synchronized, null, 2) + "\n", "utf8");
		console.log(`Synced ${locale}/${namespaceFile}`);
	}
}

console.log("Sync completed!");
