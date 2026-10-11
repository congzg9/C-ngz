import {
	CaretUpIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MinusIcon,
	PauseIcon,
	PlayIcon,
	SquareIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useScopedT } from "@/contexts/I18nContext";
import styles from "./LaunchWindow.module.css";

interface RecordingControlsProps {
	paused: boolean;
	microphoneEnabled: boolean;
	elapsed: number;
	onToggleMicrophone: () => void;
	onPauseResume: () => void;
	onStopRecording: () => void;
	onHideHud: () => void;
	onCancelRecording: () => void;
	formatTime: (seconds: number) => string;
}

export const RecordingControls = ({
	paused,
	microphoneEnabled,
	elapsed,
	onToggleMicrophone,
	onPauseResume,
	onStopRecording,
	onHideHud: _onHideHud,
	onCancelRecording,
	formatTime,
}: RecordingControlsProps) => {
	const t = useScopedT("launch");
	const [isCompact, setIsCompact] = useState(false);

	const memoizedControls = useMemo(() => {
		if (isCompact) {
			return (
				<div className="flex items-center gap-2 px-1 py-0.5 select-none">
					<div
						className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity px-1"
						onClick={() => setIsCompact(false)}
						title="Bấm để mở rộng bảng điều khiển"
					>
						<div
							className={`w-2 h-2 rounded-full ${
								paused ? "bg-[#fbbf24]" : `bg-[#f43f5e] ${styles.recDotBlink}`
							}`}
						/>
						<span
							className={`font-mono text-xs font-bold tracking-tight ${
								paused ? "text-[#fbbf24]" : "text-white"
							}`}
						>
							{formatTime(elapsed)}
						</span>
					</div>

					<Button
						variant={paused ? "default" : "ghost"}
						size="icon"
						className={`w-7 h-7 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 ${
							paused ? styles.ibGreen : ""
						}`}
						onClick={onPauseResume}
						title={paused ? t("recording.resume") : t("recording.pause")}
					>
						{paused ? (
							<PlayIcon size={14} fill="currentColor" strokeWidth={0} />
						) : (
							<PauseIcon size={14} />
						)}
					</Button>

					<Button
						variant="ghost"
						size="icon"
						className="w-7 h-7 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20 active:scale-95"
						onClick={onStopRecording}
						title={t("recording.stop")}
					>
						<SquareIcon size={13} fill="currentColor" strokeWidth={0} />
					</Button>

					<Button
						variant="ghost"
						size="icon"
						className="w-6 h-6 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95"
						onClick={() => setIsCompact(false)}
						title="Mở rộng đầy đủ"
					>
						<CaretUpIcon size={13} className="rotate-180" />
					</Button>
				</div>
			);
		}

		return (
			<>
				<div className="flex items-center gap-[5px]">
					<div
						className={`w-[7px] h-[7px] rounded-full ${
							paused ? "bg-[#fbbf24]" : `bg-[#f43f5e] ${styles.recDotBlink}`
						}`}
					/>
					<span
						className={`text-[10px] font-bold tracking-[0.06em] ${
							paused ? "text-[#fbbf24]" : "text-[#f43f5e]"
						}`}
					>
						{paused ? t("recording.paused") : t("recording.rec")}
					</span>
				</div>

				<span
					className={`font-mono text-xs font-semibold min-w-[52px] text-center tracking-[0.02em] ${
						paused ? "text-[#fbbf24]" : "text-[var(--launch-text)]"
					}`}
				>
					{formatTime(elapsed)}
				</span>

				<Separator orientation="vertical" className="mx-[5px] h-6" />

				<span title={t("recording.micToggleDisabledTip")}>
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						className={microphoneEnabled ? styles.ibActive : ""}
						aria-label={t("recording.micToggleDisabledTip")}
						disabled
						onClick={onToggleMicrophone}
					>
						{microphoneEnabled ? (
							<MicrophoneIcon size={18} />
						) : (
							<MicrophoneSlashIcon size={18} />
						)}
					</Button>
				</span>

				<Separator orientation="vertical" className="mx-[5px] h-6" />

				<Button
					variant={paused ? "default" : "ghost"}
					size="icon"
					iconSize="lg"
					onClick={onPauseResume}
					title={paused ? t("recording.resume") : t("recording.pause")}
					aria-label={paused ? t("recording.resume") : t("recording.pause")}
					className={paused ? styles.ibGreen : ""}
				>
					{paused ? (
						<PlayIcon size={18} fill="currentColor" strokeWidth={0} />
					) : (
						<PauseIcon size={18} />
					)}
				</Button>

				<Button
					variant="ghost"
					size="icon"
					iconSize="lg"
					onClick={onStopRecording}
					title={t("recording.stop")}
					aria-label={t("recording.stop")}
					className={styles.ibRed}
				>
					<SquareIcon size={16} fill="currentColor" strokeWidth={0} />
				</Button>

				<Button
					variant="ghost"
					size="icon"
					iconSize="lg"
					onClick={() => setIsCompact(true)}
					title="Thu nhỏ thanh REC (tránh che màn hình)"
					aria-label="Thu nhỏ thanh REC"
				>
					<MinusIcon size={16} />
				</Button>

				<Button
					variant="ghost"
					size="icon"
					iconSize="lg"
					onClick={onCancelRecording}
					title={t("recording.cancel")}
					aria-label={t("recording.cancel")}
				>
					<XIcon size={18} />
				</Button>
			</>
		);
	}, [
		isCompact,
		paused,
		microphoneEnabled,
		elapsed,
		onToggleMicrophone,
		onPauseResume,
		onStopRecording,
		onCancelRecording,
		formatTime,
		t,
	]);

	return memoizedControls;
};
