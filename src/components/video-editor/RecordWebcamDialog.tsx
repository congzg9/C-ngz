import {
	ArrowCounterClockwise,
	Check,
	Microphone,
	MicrophoneSlash,
	Record,
	Stop,
	VideoCamera,
} from "@phosphor-icons/react";
import { fixWebmDuration } from "@fix-webm-duration/fix";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface RecordWebcamDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRecordingComplete: (filePath: string) => void;
}

type RecordingStatus = "idle" | "countdown" | "recording" | "preview";

interface DeviceOption {
	deviceId: string;
	label: string;
}

export function RecordWebcamDialog({
	open,
	onOpenChange,
	onRecordingComplete,
}: RecordWebcamDialogProps) {
	const [status, setStatus] = useState<RecordingStatus>("idle");
	const [countdown, setCountdown] = useState<number>(3);
	const [countdownDelay, setCountdownDelay] = useState<number>(3);
	const [recordingDuration, setRecordingDuration] = useState<number>(0);
	const [videoDevices, setVideoDevices] = useState<DeviceOption[]>([]);
	const [selectedVideoId, setSelectedVideoId] = useState<string>("");
	const [audioDevices, setAudioDevices] = useState<DeviceOption[]>([]);
	const [selectedAudioId, setSelectedAudioId] = useState<string>("");
	const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const liveVideoRef = useRef<HTMLVideoElement | null>(null);
	const previewVideoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const recordedChunksRef = useRef<Blob[]>([]);
	const recordedBlobRef = useRef<Blob | null>(null);
	const recordedUrlRef = useRef<string | null>(null);
	const recordingStartTimeRef = useRef<number>(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Stop all active tracks on the camera/microphone stream
	const stopStream = useCallback(() => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}
	}, []);

	// Start or restart camera stream
	const startCamera = useCallback(async () => {
		stopStream();
		setError(null);

		try {
			const constraints: MediaStreamConstraints = {
				video: selectedVideoId
					? { deviceId: { exact: selectedVideoId }, width: { ideal: 1280 }, height: { ideal: 720 } }
					: { width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: audioEnabled
					? selectedAudioId
						? { deviceId: { exact: selectedAudioId } }
						: true
					: false,
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			streamRef.current = stream;

			if (liveVideoRef.current) {
				liveVideoRef.current.srcObject = stream;
				await liveVideoRef.current.play().catch(() => undefined);
			}

			// Update device list with populated labels
			const devices = await navigator.mediaDevices.enumerateDevices();
			const vList = devices
				.filter((d) => d.kind === "videoinput")
				.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
			const aList = devices
				.filter((d) => d.kind === "audioinput")
				.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));

			setVideoDevices(vList);
			setAudioDevices(aList);

			if (!selectedVideoId && vList.length > 0) {
				setSelectedVideoId(vList[0].deviceId);
			}
			if (!selectedAudioId && aList.length > 0) {
				setSelectedAudioId(aList[0].deviceId);
			}
		} catch (err: unknown) {
			console.error("Camera access error:", err);
			setError(
				"Không thể truy cập camera hoặc micro. Vui lòng kiểm tra quyền truy cập Camera trong Windows Settings.",
			);
		}
	}, [audioEnabled, selectedAudioId, selectedVideoId, stopStream]);

	// Initialize when dialog opens
	useEffect(() => {
		if (open) {
			setStatus("idle");
			setRecordingDuration(0);
			recordedBlobRef.current = null;
			if (recordedUrlRef.current) {
				URL.revokeObjectURL(recordedUrlRef.current);
				recordedUrlRef.current = null;
			}
			void startCamera();
		} else {
			stopStream();
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
			if (recordedUrlRef.current) {
				URL.revokeObjectURL(recordedUrlRef.current);
				recordedUrlRef.current = null;
			}
		}
		return () => {
			stopStream();
		};
	}, [open, startCamera, stopStream]);

	// Handle Countdown & Start Recording
	const handleStartRecording = () => {
		if (countdownDelay === 0) {
			beginActualRecording();
			return;
		}

		setStatus("countdown");
		setCountdown(countdownDelay);

		let count = countdownDelay;
		const countdownTimer = setInterval(() => {
			count -= 1;
			if (count <= 0) {
				clearInterval(countdownTimer);
				beginActualRecording();
			} else {
				setCountdown(count);
			}
		}, 1000);
	};

	const beginActualRecording = () => {
		if (!streamRef.current) {
			toast.error("Không tìm thấy luồng camera để quay");
			setStatus("idle");
			return;
		}

		recordedChunksRef.current = [];
		const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
			? "video/webm;codecs=vp9"
			: MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
				? "video/webm;codecs=vp8"
				: "video/webm";

		try {
			const recorder = new MediaRecorder(streamRef.current, { mimeType });
			mediaRecorderRef.current = recorder;

			recorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) {
					recordedChunksRef.current.push(e.data);
				}
			};

			recorder.onstop = async () => {
				const durationMs = Date.now() - recordingStartTimeRef.current;
				const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType });
				try {
					const fixedBlob = await fixWebmDuration(rawBlob, durationMs);
					recordedBlobRef.current = fixedBlob;
					const url = URL.createObjectURL(fixedBlob);
					recordedUrlRef.current = url;
					setStatus("preview");
				} catch (fixErr) {
					console.warn("Could not fix webm duration:", fixErr);
					recordedBlobRef.current = rawBlob;
					const url = URL.createObjectURL(rawBlob);
					recordedUrlRef.current = url;
					setStatus("preview");
				}
			};

			recordingStartTimeRef.current = Date.now();
			recorder.start(250);
			setStatus("recording");
			setRecordingDuration(0);

			timerIntervalRef.current = setInterval(() => {
				setRecordingDuration((prev) => prev + 1);
			}, 1000);
		} catch (recorderErr) {
			console.error("Failed to start MediaRecorder:", recorderErr);
			toast.error("Không thể khởi động bộ quay hình");
			setStatus("idle");
		}
	};

	const handleStopRecording = () => {
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}

		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			mediaRecorderRef.current.stop();
		}
	};

	const handleRetake = () => {
		if (recordedUrlRef.current) {
			URL.revokeObjectURL(recordedUrlRef.current);
			recordedUrlRef.current = null;
		}
		recordedBlobRef.current = null;
		setStatus("idle");
		void startCamera();
	};

	const handleSaveRecording = async () => {
		if (!recordedBlobRef.current) return;
		setIsSaving(true);

		try {
			const arrayBuffer = await recordedBlobRef.current.arrayBuffer();
			const fileName = `webcam_direct_${Date.now()}.webm`;
			const result = await window.electronAPI.storeRecordedVideo(arrayBuffer, fileName);

			if (result.success && result.path) {
				toast.success("Đã ghi hình webcam và ghép vào video thành công!");
				onRecordingComplete(result.path);
				onOpenChange(false);
			} else {
				toast.error(result.message || "Không thể lưu video quay webcam");
			}
		} catch (saveErr) {
			console.error("Error saving recorded webcam:", saveErr);
			toast.error("Lỗi khi lưu video webcam");
		} finally {
			setIsSaving(false);
		}
	};

	const formatTimer = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl rounded-2xl">
				<DialogHeader className="p-5 pb-3 border-b border-zinc-800/80">
					<DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
						<VideoCamera className="h-5 w-5 text-rose-500" weight="fill" />
						Quay Webcam Trực Tiếp
					</DialogTitle>
					<DialogDescription className="text-xs text-zinc-400">
						Ghi hình khuôn mặt trực tiếp từ camera máy tính của bạn và tự động liên kết vào lớp phủ video
					</DialogDescription>
				</DialogHeader>

				<div className="p-5 space-y-4">
					{error && (
						<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
							{error}
						</div>
					)}

					{/* Device selection controls */}
					{status === "idle" && (
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label className="text-[11px] font-medium text-zinc-400">Thiết bị Camera</label>
								<Select
									value={selectedVideoId}
									onValueChange={(val) => {
										setSelectedVideoId(val);
									}}
								>
									<SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-700/80 text-zinc-200">
										<SelectValue placeholder="Chọn Camera..." />
									</SelectTrigger>
									<SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
										{videoDevices.map((d) => (
											<SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
												{d.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1">
								<div className="flex items-center justify-between">
									<label className="text-[11px] font-medium text-zinc-400">Microphone</label>
									<button
										type="button"
										onClick={() => setAudioEnabled(!audioEnabled)}
										className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
									>
										{audioEnabled ? (
											<>
												<Microphone className="h-3 w-3 text-emerald-400" /> Bật mic
											</>
										) : (
											<>
												<MicrophoneSlash className="h-3 w-3 text-zinc-500" /> Tắt mic
											</>
										)}
									</button>
								</div>
								<Select
									disabled={!audioEnabled}
									value={selectedAudioId}
									onValueChange={(val) => {
										setSelectedAudioId(val);
									}}
								>
									<SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-700/80 text-zinc-200 disabled:opacity-50">
										<SelectValue placeholder="Chọn Micro..." />
									</SelectTrigger>
									<SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
										{audioDevices.map((d) => (
											<SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
												{d.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					)}

					{/* Viewport container */}
					<div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-zinc-800 shadow-inner flex items-center justify-center">
						{/* Live Video */}
						<video
							ref={liveVideoRef}
							className={cn(
								"h-full w-full object-cover",
								status === "preview" ? "hidden" : "block",
							)}
							style={{ transform: "scaleX(-1)" }}
							muted
							playsInline
							autoPlay
						/>

						{/* Preview Video for review */}
						{status === "preview" && recordedUrlRef.current && (
							<video
								ref={previewVideoRef}
								src={recordedUrlRef.current}
								className="h-full w-full object-cover"
								controls
								autoPlay
								playsInline
							/>
						)}

						{/* Countdown overlay */}
						{status === "countdown" && (
							<div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
								<div className="text-7xl font-extrabold text-white animate-pulse">
									{countdown}
								</div>
							</div>
						)}

						{/* Recording timer badge */}
						{status === "recording" && (
							<div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 backdrop-blur-md border border-red-500/40">
								<div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
								<span className="text-xs font-mono font-semibold text-white tracking-wider">
									REC {formatTimer(recordingDuration)}
								</span>
							</div>
						)}
					</div>

					{/* Bottom Actions */}
					<div className="flex items-center justify-between pt-2">
						{status === "idle" && (
							<div className="flex items-center gap-2">
								<span className="text-[11px] text-zinc-400">Đếm ngược:</span>
								<div className="flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800">
									{[0, 3, 5].map((d) => (
										<button
											key={d}
											type="button"
											onClick={() => setCountdownDelay(d)}
											className={cn(
												"px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
												countdownDelay === d
													? "bg-zinc-800 text-white shadow-sm"
													: "text-zinc-400 hover:text-zinc-200",
											)}
										>
											{d === 0 ? "Tắt" : `${d}s`}
										</button>
									))}
								</div>
							</div>
						)}

						{status === "preview" && (
							<Button
								type="button"
								variant="outline"
								onClick={handleRetake}
								className="h-9 gap-1.5 rounded-xl border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
							>
								<ArrowCounterClockwise className="h-4 w-4" />
								Quay lại
							</Button>
						)}

						<div className="ml-auto flex items-center gap-2">
							{status === "idle" && (
								<Button
									type="button"
									onClick={handleStartRecording}
									className="h-9 gap-2 rounded-xl bg-rose-600 px-5 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all"
								>
									<Record className="h-4 w-4" weight="fill" />
									Bắt đầu quay
								</Button>
							)}

							{status === "recording" && (
								<Button
									type="button"
									onClick={handleStopRecording}
									className="h-9 gap-2 rounded-xl bg-red-600 px-5 text-xs font-semibold text-white shadow-lg shadow-red-600/40 hover:bg-red-500 animate-pulse"
								>
									<Stop className="h-4 w-4" weight="fill" />
									Dừng & Xem lại
								</Button>
							)}

							{status === "preview" && (
								<Button
									type="button"
									disabled={isSaving}
									onClick={handleSaveRecording}
									className="h-9 gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-95 transition-all"
								>
									<Check className="h-4 w-4" />
									{isSaving ? "Đang lưu..." : "Dùng video này"}
								</Button>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
