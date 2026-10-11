import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary.tsx";
import { I18nProvider } from "./contexts/I18nContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import "./index.css";
import { FilterSystem } from "pixi.js";

// Patch Pixi v8 FilterSystem._findFilterResolution to prevent TypeError when inputTexture.source is null/pooled
if ((FilterSystem as any)?.prototype) {
	(FilterSystem.prototype as any)._findFilterResolution = function (rootResolution: number) {
		let currentIndex = (this as any)._filterStackIndex - 1;
		const stack = (this as any)._filterStack;
		while (currentIndex > 0 && stack?.[currentIndex]?.skip) {
			--currentIndex;
		}
		const stackItem = currentIndex > 0 && stack ? stack[currentIndex] : null;
		return stackItem?.inputTexture?.source?._resolution ?? rootResolution;
	};
}

document.documentElement.dataset.platform = /mac/i.test(navigator.platform) ? "macos" : "other";

import { createWebElectronAPI, setupExtensionMessageListener } from "./lib/webAdapter.ts";

if (typeof window !== "undefined" && !(window as any).electronAPI) {
	(window as any).electronAPI = createWebElectronAPI();
	setupExtensionMessageListener();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ErrorBoundary>
			<ThemeProvider>
				<I18nProvider>
					<App />
				</I18nProvider>
			</ThemeProvider>
		</ErrorBoundary>
	</React.StrictMode>,
);
