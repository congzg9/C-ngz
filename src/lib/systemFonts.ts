// Utility to query and detect system fonts installed on the computer (Windows/macOS/Linux)

export const POPULAR_SYSTEM_FONTS = [
	"Arial",
	"Arial Black",
	"Bahnschrift",
	"Calibri",
	"Cambria",
	"Candara",
	"Century Gothic",
	"Comic Sans MS",
	"Consolas",
	"Constantia",
	"Corbel",
	"Courier New",
	"Franklin Gothic Medium",
	"Futura",
	"Gabriola",
	"Georgia",
	"Gill Sans",
	"Helvetica",
	"Helvetica Neue",
	"Impact",
	"Lucida Console",
	"Lucida Grande",
	"Lucida Sans",
	"Microsoft Sans Serif",
	"Montserrat",
	"Open Sans",
	"Optima",
	"Palatino",
	"Palatino Linotype",
	"Roboto",
	"San Francisco",
	"Segoe UI",
	"Segoe UI Emoji",
	"Segoe UI Semibold",
	"Sitka",
	"Sylfaen",
	"Tahoma",
	"Times New Roman",
	"Trebuchet MS",
	"Verdana",
];

let cachedInstalledFonts: string[] | null = null;

/**
 * Detects whether a font is installed locally on the user's computer
 * using standard canvas glyph width difference analysis.
 */
function isFontAvailable(fontName: string): boolean {
	if (typeof document === "undefined") return false;

	const testString = "mmmmmmmmmmlliWWWW1234567890!@#$%";
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) return false;

	// Baseline monospace
	context.font = "72px monospace";
	const baselineMono = context.measureText(testString).width;

	// Baseline sans-serif
	context.font = "72px sans-serif";
	const baselineSans = context.measureText(testString).width;

	// Test with fontName fallback to monospace
	context.font = `72px "${fontName}", monospace`;
	const testMono = context.measureText(testString).width;

	// Test with fontName fallback to sans-serif
	context.font = `72px "${fontName}", sans-serif`;
	const testSans = context.measureText(testString).width;

	return testMono !== baselineMono || testSans !== baselineSans;
}

/**
 * Retrieves the list of fonts installed on the user's computer.
 * Uses window.queryLocalFonts() if supported, otherwise falls back to detecting
 * popular installed system fonts on the machine.
 */
export async function getSystemFonts(): Promise<string[]> {
	if (cachedInstalledFonts && cachedInstalledFonts.length > 0) {
		return cachedInstalledFonts;
	}

	// 1. Try modern Chromium / Electron Local Font Access API
	if (typeof window !== "undefined" && "queryLocalFonts" in window) {
		try {
			const localFonts = await (window as unknown as { queryLocalFonts: () => Promise<Array<{ family: string }>> }).queryLocalFonts();
			const families = Array.from(new Set(localFonts.map((f) => f.family)))
				.filter((f) => Boolean(f) && !f.startsWith("@"))
				.sort((a, b) => a.localeCompare(b));
			if (families.length > 0) {
				cachedInstalledFonts = families;
				return families;
			}
		} catch {
			// Permission was dismissed or denied, fall through to detection
		}
	}

	// 2. Fallback: filter popular fonts by checking actual system installation
	const detected = POPULAR_SYSTEM_FONTS.filter((font) => isFontAvailable(font));
	const fallbackFonts = detected.length > 5 ? detected : POPULAR_SYSTEM_FONTS;

	cachedInstalledFonts = fallbackFonts.sort((a, b) => a.localeCompare(b));
	return cachedInstalledFonts;
}
