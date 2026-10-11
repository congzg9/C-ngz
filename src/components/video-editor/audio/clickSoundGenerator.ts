import { createBufferFromRealSample } from "./realMouseSamples";

export type ClickSoundStyle =
	| "crisp"
	| "hard"
	| "silent"
	| "mechanical"
	| "trackpad"
	| "pop"
	| "tap"
	| "pen";

export interface ClickSoundStyleOption {
	id: ClickSoundStyle;
	label: string;
	description: string;
}

export const CLICK_SOUND_STYLES: ClickSoundStyleOption[] = [
	{
		id: "crisp",
		label: "Chuột Crisp (Đanh)",
		description: "Âm click đanh, nảy sắc nét, dứt khoát",
	},
	{
		id: "hard",
		label: "Chuột Hard (Nặng)",
		description: "Âm click đầm chắc, cơ học lực mạnh, dứt khoát",
	},
	{
		id: "silent",
		label: "Chuột êm (Silent)",
		description: "Âm click êm ái giảm ồn (Logitech Silent Touch / M590)",
	},
	{
		id: "mechanical",
		label: "Chuột Gaming",
		description: "Âm switch cơ học đanh, nảy và dứt khoát",
	},
	{
		id: "trackpad",
		label: "Trackpad",
		description: "Âm haptic Taptic Engine gõ nhẹ như MacBook",
	},
	{
		id: "pop",
		label: "Bọt nước",
		description: "Âm ASMR bọt nước mềm mại Screen Studio",
	},
	{
		id: "tap",
		label: "Gõ nhẹ",
		description: "Âm gõ thanh mảnh tối giản",
	},
	{
		id: "pen",
		label: "Bút bấm",
		description: "Âm lách cách lò xo bút bấm",
	},
];

let previewAudioContext: AudioContext | null = null;

function getPreviewAudioContext(): AudioContext | null {
	if (typeof window === "undefined") return null;

	if (previewAudioContext && previewAudioContext.state !== "closed") {
		return previewAudioContext;
	}

	const AudioContextCtor =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

	if (!AudioContextCtor) return null;

	previewAudioContext = new AudioContextCtor();
	return previewAudioContext;
}

/**
 * Synthesizes or retrieves an AudioBuffer containing a clean, studio-quality click sound.
 * Real mouse styles ("mouse", "crisp", "hard", "soft") use authentic high-fidelity studio recordings.
 * Can be used in both live playback (AudioContext) and offline export (OfflineAudioContext).
 */
export function generateClickSoundBuffer(
	ctx: BaseAudioContext,
	style: ClickSoundStyle = "crisp",
	volume = 0.7,
): AudioBuffer {
	// Prioritize authentic physical studio recordings for genuine mouse tactile acoustics
	const realBuffer = createBufferFromRealSample(ctx, style, volume);
	if (realBuffer) {
		return realBuffer;
	}

	const durationSec = 0.055;
	const sampleRate = ctx.sampleRate || 48000;
	const frameCount = Math.floor(sampleRate * durationSec);
	const buffer = ctx.createBuffer(1, frameCount, sampleRate);
	const data = buffer.getChannelData(0);
	const clampedVolume = Math.max(0, Math.min(1.5, volume));

	for (let i = 0; i < frameCount; i++) {
		const t = i / sampleRate;
		let s = 0;

		switch (style) {
			case "crisp": {
				// Crisp: Sharp high-pitch attack, fast decay, bright spring snap
				const p = (t - 0.00015) / 0.00012;
				const shock = Math.exp(-0.5 * p * p) * (1 - p * p) * 1.9;
				const snap1 = Math.sin(2 * Math.PI * 3600 * t) * Math.exp(-t / 0.0022);
				const snap2 = Math.sin(2 * Math.PI * 5800 * t) * Math.exp(-t / 0.0016) * 0.6;
				const clickNoise = (Math.random() * 2 - 1) * Math.exp(-t / 0.0009) * 0.45;
				const body = Math.sin(2 * Math.PI * 1250 * t) * Math.exp(-t / 0.005) * 0.3;
				s = Math.tanh(
					(shock * 0.5 + snap1 * 0.55 + snap2 * 0.35 + clickNoise + body) * 1.4,
				);
				break;
			}
			case "hard": {
				// Hard: Deep heavy tactile bottom-out, lower fundamental, solid body thump
				const p = (t - 0.0003) / 0.00028;
				const shock = Math.exp(-0.5 * p * p) * (1 - p * p) * 2.2;
				const lowThump = Math.sin(2 * Math.PI * 480 * t) * Math.exp(-t / 0.016) * 0.65;
				const spring1 = Math.sin(2 * Math.PI * 1950 * t) * Math.exp(-t / 0.005) * 0.55;
				const spring2 = Math.sin(2 * Math.PI * 3100 * t) * Math.exp(-t / 0.003) * 0.35;
				const noise = (Math.random() * 2 - 1) * Math.exp(-t / 0.0015) * 0.35;
				s = Math.tanh((shock * 0.6 + lowThump + spring1 + spring2 + noise) * 1.5);
				break;
			}
			case "silent": {
				// Muffled silent mouse click (Logitech Silent Touch / MX Master 3S)
				const thud = Math.sin(2 * Math.PI * (420 - t * 4000) * t) * Math.exp(-t / 0.014);
				const sub = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t / 0.022);
				const softTransient = (Math.random() * 2 - 1) * Math.exp(-t / 0.0012) * 0.15;
				s = thud * 0.65 + sub * 0.35 + softTransient;
				break;
			}
			case "mechanical": {
				// Sharp attack transient (high-passed noise burst ~2-3ms)
				const noise = (Math.random() * 2 - 1) * Math.exp(-t / 0.002);
				// Metallic micro-switch body resonance ~2.1kHz decaying rapidly
				const body = Math.sin(2 * Math.PI * (2100 - t * 14000) * t) * Math.exp(-t / 0.012);
				// Bottom shell snap ~850Hz
				const snap = Math.sin(2 * Math.PI * 850 * t) * Math.exp(-t / 0.008);
				s = noise * 0.42 + body * 0.45 + snap * 0.22;
				break;
			}
			case "trackpad": {
				// Apple MacBook Force Touch haptic actuator thump
				const haptic = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t / 0.011);
				const surface = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t / 0.004) * 0.3;
				s = haptic * 0.85 + surface;
				break;
			}
			case "pop": {
				// Smooth downward frequency sweep from 1400Hz to 280Hz
				const phase = 2 * Math.PI * (280 * t - 1120 * 0.008 * (Math.exp(-t / 0.008) - 1));
				s = Math.sin(phase) * Math.exp(-t / 0.018) * 0.95;
				break;
			}
			case "tap": {
				// Clean minimal wood / glass tap
				const body = Math.sin(2 * Math.PI * 720 * t) * Math.exp(-t / 0.015);
				const click = (Math.random() * 2 - 1) * Math.exp(-t / 0.003) * 0.5;
				s = body * 0.7 + click * 0.3;
				break;
			}
			case "pen": {
				// Dual micro-transient: initial strike then spring click
				const c1 = Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t / 0.004) * 0.6;
				const t2 = Math.max(0, t - 0.012);
				const c2 =
					t >= 0.012
						? Math.sin(2 * Math.PI * 2500 * t2) * Math.exp(-t2 / 0.005) * 0.45
						: 0;
				s = c1 + c2;
				break;
			}
			default: {
				s = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t / 0.01);
				break;
			}
		}

		// Ensure smooth fade-out at the end to prevent speaker clicks
		const fadeOut = Math.min(1, (durationSec - t) / 0.008);
		data[i] = s * clampedVolume * Math.max(0, fadeOut);
	}

	return buffer;
}

/**
 * Plays a click sound directly in the browser/Electron preview using Web Audio API.
 */
export function playClickSound(style: ClickSoundStyle = "crisp", volume = 0.7): void {
	try {
		const ctx = getPreviewAudioContext();
		if (!ctx) return;

		if (ctx.state === "suspended") {
			void ctx.resume().catch(() => undefined);
		}

		const buffer = generateClickSoundBuffer(ctx, style, volume);
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(ctx.destination);
		source.start();
	} catch {
		// Cosmetic audio failure ignored
	}
}
