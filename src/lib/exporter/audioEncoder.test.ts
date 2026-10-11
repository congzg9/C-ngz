import { describe, expect, it, vi } from "vitest";

import { AudioProcessor, type ClickSoundExportOptions } from "./audioEncoder";

type OfflineRenderTestHarness = AudioProcessor & {
	decodeAudioFromUrl(url: string): Promise<AudioBuffer | null>;
	getMediaDurationSec(url: string): Promise<number>;
	loadAudioFileDemuxer(audioPath: string): Promise<unknown>;
	prepareOfflineRender(
		videoUrl: string,
		trimRegions: unknown[],
		speedRegions: unknown[],
		audioRegions: unknown[],
		sourceAudioFallbackPaths: string[],
		sourceAudioFallbackStartDelayMsByPath?: Record<string, number>,
		sourceAudioTrackSettings?: unknown,
		clipRegions?: unknown[],
		clickSoundOptions?: ClickSoundExportOptions,
	): Promise<{
		mainBufferEntry: { buffer: AudioBuffer; gain: number } | null;
		companionEntries: Array<{ buffer: AudioBuffer; startDelaySec: number }>;
		clickSoundOptions?: {
			style: string;
			volume: number;
			clicks: Array<{ outputTimeMs: number }>;
		} | null;
	}>;
	renderAndMuxOfflineAudio(
		videoUrl: string,
		trimRegions: never[],
		speedRegions: never[],
		audioRegions: never[],
		sourceAudioFallbackPaths: string[],
		sourceAudioFallbackStartDelayMsByPath: Record<string, number> | undefined,
		muxer: unknown,
	): Promise<void>;
};

describe("AudioProcessor offline render preparation", () => {
	it("keeps embedded source audio separate from external companion sidecars", async () => {
		const processor = new AudioProcessor() as unknown as OfflineRenderTestHarness;
		const mainBuffer = { duration: 10, numberOfChannels: 2 } as AudioBuffer;
		const micBuffer = { duration: 9.5, numberOfChannels: 1 } as AudioBuffer;

		const decodeAudioFromUrl = vi
			.spyOn(processor, "decodeAudioFromUrl")
			.mockImplementation(async (url: string) => {
				if (url === "file:///tmp/recording.mp4") {
					return mainBuffer;
				}
				if (url === "/tmp/recording.mic.wav") {
					return micBuffer;
				}
				return null;
			});
		vi.spyOn(processor, "getMediaDurationSec").mockResolvedValue(10);

		const prepared = await processor.prepareOfflineRender(
			"file:///tmp/recording.mp4",
			[],
			[],
			[],
			["/tmp/recording.mp4", "/tmp/recording.mic.wav"],
		);

		expect(prepared.mainBufferEntry?.buffer).toBe(mainBuffer);
		expect(prepared.companionEntries).toHaveLength(1);
		expect(prepared.companionEntries[0]?.buffer).toBe(micBuffer);
		expect(decodeAudioFromUrl).toHaveBeenCalledWith("file:///tmp/recording.mp4");
		expect(decodeAudioFromUrl).toHaveBeenCalledWith("/tmp/recording.mic.wav");
		expect(decodeAudioFromUrl).not.toHaveBeenCalledWith("/tmp/recording.mp4");
	});

	it("does not treat a single embedded fallback path as an external sidecar", async () => {
		const processor = new AudioProcessor() as unknown as OfflineRenderTestHarness;
		const loadAudioFileDemuxer = vi.spyOn(processor, "loadAudioFileDemuxer");
		const renderAndMuxOfflineAudio = vi
			.spyOn(processor, "renderAndMuxOfflineAudio")
			.mockResolvedValue();

		await processor.process(
			null,
			{} as never,
			"file:///tmp/recording.mp4",
			[],
			[],
			undefined,
			[],
			["/tmp/recording.mp4"],
		);

		expect(loadAudioFileDemuxer).not.toHaveBeenCalled();
		expect(renderAndMuxOfflineAudio).not.toHaveBeenCalled();
	});

	it("uses recorded companion start-delay metadata instead of inferring from duration gap", async () => {
		const processor = new AudioProcessor() as unknown as OfflineRenderTestHarness;
		const mainBuffer = { duration: 600, numberOfChannels: 2 } as AudioBuffer;
		const micBuffer = { duration: 565, numberOfChannels: 1 } as AudioBuffer;

		vi.spyOn(processor, "decodeAudioFromUrl").mockImplementation(async (url: string) => {
			if (url === "file:///tmp/recording.mp4") {
				return mainBuffer;
			}
			if (url === "/tmp/recording.mic.webm") {
				return micBuffer;
			}
			return null;
		});

		const prepared = await processor.prepareOfflineRender(
			"file:///tmp/recording.mp4",
			[],
			[],
			[],
			["/tmp/recording.mic.webm"],
			{ "/tmp/recording.mic.webm": 3_500 },
		);

		expect(prepared.companionEntries[0]?.startDelaySec).toBeCloseTo(3.5);
	});

	it("avoids the single-sidecar fast path when companion timing metadata is present", async () => {
		const processor = new AudioProcessor() as unknown as OfflineRenderTestHarness;
		const loadAudioFileDemuxer = vi.spyOn(processor, "loadAudioFileDemuxer");
		const renderAndMuxOfflineAudio = vi
			.spyOn(processor, "renderAndMuxOfflineAudio")
			.mockResolvedValue();

		await processor.process(
			null,
			{} as never,
			"file:///tmp/recording.mp4",
			[],
			[],
			undefined,
			[],
			["/tmp/recording.mic.webm"],
			{ "/tmp/recording.mic.webm": 2_000 },
		);

		expect(loadAudioFileDemuxer).not.toHaveBeenCalled();
		expect(renderAndMuxOfflineAudio).toHaveBeenCalled();
	});

	it("extracts and schedules click sounds during offline render preparation", async () => {
		const processor = new AudioProcessor() as unknown as OfflineRenderTestHarness;
		const mainBuffer = { duration: 10, numberOfChannels: 2 } as AudioBuffer;

		vi.spyOn(processor, "decodeAudioFromUrl").mockResolvedValue(mainBuffer);
		vi.spyOn(processor, "getMediaDurationSec").mockResolvedValue(10);

		const prepared = await processor.prepareOfflineRender(
			"file:///tmp/recording.mp4",
			[{ startMs: 3000, endMs: 5000 }], // trim 3s-5s out
			[],
			[],
			[],
			undefined,
			undefined,
			undefined,
			{
				enabled: true,
				style: "pop",
				volume: 0.8,
				cursorTelemetry: [
					{ timeMs: 1000, interactionType: "click" },
					{ timeMs: 4000, interactionType: "click" }, // trimmed out!
					{ timeMs: 6000, interactionType: "double-click" }, // 6000 is 4000 in output timeline (after 2s trimmed out)
					{ timeMs: 7000, interactionType: "move" }, // not a click
				],
			},
		);

		expect(prepared.clickSoundOptions).toBeDefined();
		expect(prepared.clickSoundOptions?.style).toBe("pop");
		expect(prepared.clickSoundOptions?.volume).toBe(0.8);
		// click at 1000ms -> 1000ms
		// click at 4000ms -> filtered out (in trimmed region)
		// double-click at 6000ms -> 4000ms and 4110ms
		expect(prepared.clickSoundOptions?.clicks).toHaveLength(3);
		expect(prepared.clickSoundOptions?.clicks[0].outputTimeMs).toBe(1000);
		expect(prepared.clickSoundOptions?.clicks[1].outputTimeMs).toBe(4000);
		expect(prepared.clickSoundOptions?.clicks[2].outputTimeMs).toBe(4110);
	});
});
