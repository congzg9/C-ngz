import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extensions", () => ({
	extensionHost: {
		emitEvent: vi.fn(),
	},
}));

import { extensionHost } from "@/lib/extensions";
import { createVideoEventHandlers } from "./videoEventHandlers";

type PresentedFrameCallback = (now: DOMHighResTimeStamp, metadata: { mediaTime?: number }) => void;

type MockVideo = HTMLVideoElement & {
	requestVideoFrameCallback?: (callback: PresentedFrameCallback) => number;
	cancelVideoFrameCallback?: (handle: number) => void;
};

function createMutableRef<T>(value: T) {
	return { current: value };
}

function createMockVideo(overrides: Partial<MockVideo> = {}): MockVideo {
	const video = {
		currentTime: 0.5,
		duration: 10,
		paused: false,
		ended: false,
		playbackRate: 1,
		pause: vi.fn(),
	} as unknown as MockVideo;

	return Object.assign(video, overrides);
}

describe("createVideoEventHandlers", () => {
	const emitEventMock = vi.mocked(extensionHost.emitEvent);
	let requestAnimationFrameMock: ReturnType<typeof vi.fn>;
	let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		requestAnimationFrameMock = vi.fn(() => 11);
		cancelAnimationFrameMock = vi.fn();
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
		vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);
		emitEventMock.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("prefers requestVideoFrameCallback mediaTime when available", () => {
		let presentedFrameCallback: PresentedFrameCallback | null = null;
		const video = createMockVideo({
			requestVideoFrameCallback: vi.fn((callback) => {
				presentedFrameCallback = callback;
				return 7;
			}),
			cancelVideoFrameCallback: vi.fn(),
		});
		const onPlayStateChange = vi.fn();
		const onTimeUpdate = vi.fn();
		const currentTimeRef = createMutableRef(0);
		const timeUpdateAnimationRef = createMutableRef<number | null>(null);

		const handlers = createVideoEventHandlers({
			video,
			isSeekingRef: createMutableRef(false),
			isPlayingRef: createMutableRef(false),
			allowPlaybackRef: createMutableRef(true),
			currentTimeRef,
			timeUpdateAnimationRef,
			onPlayStateChange,
			onTimeUpdate,
			trimRegionsRef: createMutableRef([]),
			speedRegionsRef: createMutableRef([]),
		});

		handlers.handlePlay();
		expect(onPlayStateChange).toHaveBeenCalledWith(true);
		expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
		expect(requestAnimationFrameMock).not.toHaveBeenCalled();

		presentedFrameCallback?.(0, { mediaTime: 1.25 });

		expect(onTimeUpdate).toHaveBeenCalledWith(1.25);
		expect(currentTimeRef.current).toBe(1250);
		expect(emitEventMock).toHaveBeenLastCalledWith({
			type: "playback:timeupdate",
			timeMs: 1250,
		});
	});

	it("falls back to requestAnimationFrame when requestVideoFrameCallback is unavailable", () => {
		let animationFrameCallback: FrameRequestCallback | null = null;
		requestAnimationFrameMock.mockImplementation((callback: FrameRequestCallback) => {
			animationFrameCallback = callback;
			return 19;
		});
		const video = createMockVideo({ currentTime: 0.75 });
		const onTimeUpdate = vi.fn();

		const handlers = createVideoEventHandlers({
			video,
			isSeekingRef: createMutableRef(false),
			isPlayingRef: createMutableRef(false),
			allowPlaybackRef: createMutableRef(true),
			currentTimeRef: createMutableRef(0),
			timeUpdateAnimationRef: createMutableRef<number | null>(null),
			onPlayStateChange: vi.fn(),
			onTimeUpdate,
			trimRegionsRef: createMutableRef([]),
			speedRegionsRef: createMutableRef([]),
		});

		handlers.handlePlay();
		expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

		video.paused = true;
		animationFrameCallback?.(0);

		expect(onTimeUpdate).toHaveBeenCalledWith(0.75);
	});

	it("skips removed footage when playback reaches a cut region", () => {
		let animationFrameCallback: FrameRequestCallback | null = null;
		requestAnimationFrameMock.mockImplementation((callback: FrameRequestCallback) => {
			animationFrameCallback = callback;
			return 29;
		});
		const video = createMockVideo({ currentTime: 1.25, duration: 10 });
		const onTimeUpdate = vi.fn();
		const handlers = createVideoEventHandlers({
			video,
			isSeekingRef: createMutableRef(false),
			isPlayingRef: createMutableRef(false),
			allowPlaybackRef: createMutableRef(true),
			currentTimeRef: createMutableRef(0),
			timeUpdateAnimationRef: createMutableRef<number | null>(null),
			onPlayStateChange: vi.fn(),
			onTimeUpdate,
			trimRegionsRef: createMutableRef([{ id: "trim-1", startMs: 1000, endMs: 2000 }]),
			speedRegionsRef: createMutableRef([]),
		});

		handlers.handlePlay();
		animationFrameCallback?.(0);

		expect(video.currentTime).toBe(2);
		expect(video.pause).not.toHaveBeenCalled();
		expect(onTimeUpdate).toHaveBeenLastCalledWith(2);
	});

	it("cancels a pending requestVideoFrameCallback on pause and dispose", () => {
		const cancelVideoFrameCallback = vi.fn();
		const video = createMockVideo({
			requestVideoFrameCallback: vi.fn(() => 23),
			cancelVideoFrameCallback,
		});
		const handlers = createVideoEventHandlers({
			video,
			isSeekingRef: createMutableRef(false),
			isPlayingRef: createMutableRef(false),
			allowPlaybackRef: createMutableRef(true),
			currentTimeRef: createMutableRef(0),
			timeUpdateAnimationRef: createMutableRef<number | null>(null),
			onPlayStateChange: vi.fn(),
			onTimeUpdate: vi.fn(),
			trimRegionsRef: createMutableRef([]),
			speedRegionsRef: createMutableRef([]),
		});

		handlers.handlePlay();
		handlers.handlePause();
		expect(cancelVideoFrameCallback).toHaveBeenCalledWith(23);

		cancelVideoFrameCallback.mockClear();
		handlers.handlePlay();
		handlers.dispose();
		expect(cancelVideoFrameCallback).toHaveBeenCalledWith(23);
	});

	it("skips removed footage after a paused seek", () => {
		const video = createMockVideo({
			currentTime: 1.25,
			paused: true,
		});
		const onTimeUpdate = vi.fn();
		const handlers = createVideoEventHandlers({
			video,
			isSeekingRef: createMutableRef(true),
			isPlayingRef: createMutableRef(false),
			allowPlaybackRef: createMutableRef(true),
			currentTimeRef: createMutableRef(0),
			timeUpdateAnimationRef: createMutableRef<number | null>(null),
			onPlayStateChange: vi.fn(),
			onTimeUpdate,
			trimRegionsRef: createMutableRef([{ id: "trim-1", startMs: 1000, endMs: 2000 }]),
			speedRegionsRef: createMutableRef([]),
		});

		handlers.handleSeeked();

		expect(video.currentTime).toBe(2);
		expect(onTimeUpdate).toHaveBeenLastCalledWith(2);
	});

	it("preserves last presented frame time on pause instead of jumping to decoder lookahead time", () => {
		let presentedFrameCallback: PresentedFrameCallback | null = null;
		const video = createMockVideo({
			currentTime: 1.25, // Decoder clock is ahead
			requestVideoFrameCallback: vi.fn((callback) => {
				presentedFrameCallback = callback;
				return 42;
			}),
			cancelVideoFrameCallback: vi.fn(),
		});
		const onTimeUpdate = vi.fn();
		const currentTimeRef = createMutableRef(0);
		const isPlayingRef = createMutableRef(false);

		const handlers = createVideoEventHandlers({
			video,
			isSeekingRef: createMutableRef(false),
			isPlayingRef,
			allowPlaybackRef: createMutableRef(true),
			currentTimeRef,
			timeUpdateAnimationRef: createMutableRef<number | null>(null),
			onPlayStateChange: vi.fn(),
			onTimeUpdate,
			trimRegionsRef: createMutableRef([]),
			speedRegionsRef: createMutableRef([]),
		});

		handlers.handlePlay();
		// Simulate frame presented at 1.20s while decoder currentTime is ahead at 1.233s
		video.currentTime = 1.233;
		presentedFrameCallback?.(0, { mediaTime: 1.2 });
		expect(onTimeUpdate).toHaveBeenLastCalledWith(1.2);

		// Now pause: decoder currentTime is ahead at 1.245s, but pause must keep presented 1.20s
		video.currentTime = 1.245;
		handlers.handlePause();

		// Should NOT jump to 1.245s, must retain 1.20s
		expect(onTimeUpdate).toHaveBeenLastCalledWith(1.2);
		expect(currentTimeRef.current).toBe(1200);

		// Late in-flight callback must be rejected after pause
		presentedFrameCallback?.(0, { mediaTime: 1.18 });
		expect(onTimeUpdate).toHaveBeenLastCalledWith(1.2);
	});

	it("ignores seeking and seeked events when isInternalSeekingRef is active", () => {
		const video = createMockVideo({
			currentTime: 3.5,
		});
		const onTimeUpdate = vi.fn();
		const isInternalSeekingRef = createMutableRef(true);
		const isSeekingRef = createMutableRef(false);

		const handlers = createVideoEventHandlers({
			video,
			isSeekingRef,
			isPlayingRef: createMutableRef(false),
			allowPlaybackRef: createMutableRef(true),
			currentTimeRef: createMutableRef(0),
			timeUpdateAnimationRef: createMutableRef<number | null>(null),
			onPlayStateChange: vi.fn(),
			onTimeUpdate,
			trimRegionsRef: createMutableRef([]),
			speedRegionsRef: createMutableRef([]),
			isInternalSeekingRef,
		});

		handlers.handleSeeking();
		expect(isSeekingRef.current).toBe(false);
		expect(onTimeUpdate).not.toHaveBeenCalled();

		handlers.handleSeeked();
		expect(onTimeUpdate).not.toHaveBeenCalled();

		// When internal seeking flag is deactivated, seeking events work normally
		isInternalSeekingRef.current = false;
		handlers.handleSeeking();
		expect(isSeekingRef.current).toBe(true);
		expect(onTimeUpdate).toHaveBeenCalledWith(3.5);
	});
});
