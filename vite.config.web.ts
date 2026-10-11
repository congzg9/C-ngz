import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite configuration for standalone Web build (Cloudflare Pages / Browser)
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	optimizeDeps: {
		entries: ["index.html"],
		exclude: [
			"react-icons/bs",
			"react-icons/fa",
			"react-icons/fa6",
			"react-icons/fi",
			"react-icons/md",
			"react-icons/rx",
		],
	},
	build: {
		outDir: "dist-web",
		emptyOutDir: true,
		target: "esnext",
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: false, // Keep logs for easier web debugging
				drop_debugger: true,
			},
		},
		rollupOptions: {
			output: {
				manualChunks: {
					pixi: ["pixi.js"],
					"react-vendor": ["react", "react-dom"],
					"video-processing": ["mediabunny", "mp4box", "@fix-webm-duration/fix"],
				},
			},
		},
		chunkSizeWarningLimit: 1200,
	},
});
