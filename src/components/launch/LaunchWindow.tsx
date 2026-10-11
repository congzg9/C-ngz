import {
	ArrowClockwiseIcon,
	CaretUpIcon,
	CrownIcon,
	DotsThreeVerticalIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MinusIcon,
	MonitorIcon,
	TimerIcon,
	VideoCameraIcon,
	VideoCameraSlashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RxDragHandleDots2 } from "react-icons/rx";
import { LicenseModal } from "@/components/license/LicenseModal";
import { Separator } from "@/components/ui/separator";
import { useScopedT } from "../../contexts/I18nContext";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useVideoDevices } from "../../hooks/useVideoDevices";
import { Button } from "../ui/button";
import { HudInteractionContext } from "./contexts/HudInteractionContext";
import { canToggleFloatingWebcamPreview } from "./floatingWebcamPreview";
import { useHudBarDrag } from "./hooks/useHudBarDrag";
import { useLaunchHudInteractionState } from "./hooks/useLaunchHudInteractionState";
import { useLaunchWindowActions } from "./hooks/useLaunchWindowActions";
import { useLaunchWindowSystemState } from "./hooks/useLaunchWindowSystemState";
import { useRecordingTimer } from "./hooks/useRecordingTimer";
import { useWebcamPreviewOverlay } from "./hooks/useWebcamPreviewOverlay";
import styles from "./LaunchWindow.module.css";
import { CountdownPopover } from "./popovers/CountdownPopover";
import {
	LaunchPopoverCoordinatorProvider,
	useLaunchPopoverCoordinator,
} from "./popovers/LaunchPopoverCoordinator";
import type { DesktopSource } from "./popovers/launchPopoverTypes";
import { MicPopover } from "./popovers/MicPopover";
import { MorePopover } from "./popovers/MorePopover";
import { ProjectPopover } from "./popovers/ProjectPopover";
import { SourcePopover } from "./popovers/SourcePopover";
import { WebcamPopover } from "./popovers/WebcamPopover";
import { RecordingControls } from "./RecordingControls";
import { MarqueeText } from "./SourceSelector";

const SHOW_DEV_UPDATE_PREVIEW = import.meta.env.DEV;

export function LaunchWindow() {
	return (
		<LaunchPopoverCoordinatorProvider>
			<LaunchWindowContent />
		</LaunchPopoverCoordinatorProvider>
	);
}

function LaunchWindowContent() {
	const t = useScopedT("launch");
	const { openId, requestClose, requestOpen } = useLaunchPopoverCoordinator();

	const {
		recording,
		paused,
		finalizing,
		countdownActive,
		toggleRecording,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		webcamEnabled,
		setWebcamEnabled,
		webcamDeviceId,
		setWebcamDeviceId,
		countdownDelay,
		setCountdownDelay,
		preparePermissions,
	} = useScreenRecorder();

	const { elapsed, formatTime } = useRecordingTimer(recording, paused);
	const [licenseModalOpen, setLicenseModalOpen] = useState(false);
	const [usageStats, setUsageStats] = useState<{ isPro: boolean; remaining: number }>({ isPro: false, remaining: 5 });
	const hudContentRef = useRef<HTMLDivElement>(null);
	const hudBarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const updateUsage = async () => {
			try {
				if (window.electronAPI?.getRecordingUsage) {
					const stats = await window.electronAPI.getRecordingUsage();
					setUsageStats({ isPro: stats.isPro, remaining: stats.remaining });
				}
			} catch (_) {}
		};
		void updateUsage();

		const handleOpenLicense = () => {
			setLicenseModalOpen(true);
		};
		window.addEventListener("open-license-modal", handleOpenLicense);
		return () => {
			window.removeEventListener("open-license-modal", handleOpenLicense);
		};
	}, [licenseModalOpen]);

	const {
		selectedSource,
		hasSelectedSource,
		projectLibraryEntries,
		handleSourceSelect,
		openVideoFile,
		openProjectFromLibrary,
		syncSelectedSource,
		refreshProjectLibrary,
	} = useLaunchWindowActions();

	const showWebcamControls = webcamEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } = useMicrophoneDevices(
		microphoneEnabled || openId === "mic",
		microphoneDeviceId,
	);
	const {
		devices: videoDevices,
		selectedDeviceId: selectedVideoDeviceId,
		setSelectedDeviceId: setSelectedVideoDeviceId,
	} = useVideoDevices(webcamEnabled || openId === "webcam");

	const {
		hudOverlayMousePassthroughSupported,
		platform,
		appVersion,
		hideHudFromCapture,
		chooseRecordingsDirectory,
		toggleHudCaptureProtection,
	} = useLaunchWindowSystemState(preparePermissions);

	const supportsHudCaptureProtection = platform !== "linux";

	useEffect(() => {
		if (!selectedDeviceId) {
			return;
		}

		setMicrophoneDeviceId(selectedDeviceId === "default" ? undefined : selectedDeviceId);
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		if (selectedVideoDeviceId && selectedVideoDeviceId !== "default") {
			setWebcamDeviceId(selectedVideoDeviceId);
		}
	}, [selectedVideoDeviceId, setWebcamDeviceId]);

	const {
		showFloatingWebcamPreview,
		setShowFloatingWebcamPreview,
		showRecordingWebcamPreview,
		webcamPreviewOffset,
		recordingWebcamPreviewContainerRef,
		isWebcamPreviewDraggingRef,
		webcamPreviewDragStartRef,
		handleWebcamPreviewPointerDown,
		handleWebcamPreviewPointerMove,
		handleWebcamPreviewPointerUp,
		setWebcamPreviewNode,
		setRecordingWebcamPreviewNode,
	} = useWebcamPreviewOverlay({
		webcamEnabled,
		webcamDeviceId,
		showWebcamControls,
		webcamPopoverOpen: openId === "webcam",
		hudOverlayMousePassthroughSupported,
	});

	const {
		recordingHudOffset,
		isHudDragging,
		hudBarTransformRef,
		isHudDraggingRef,
		handleHudBarPointerDown,
		handleHudBarPointerMove,
		handleHudBarPointerUp,
	} = useHudBarDrag({
		hudContentRef,
		hudBarRef,
		recordingWebcamPreviewContainerRef,
	});

	const { handleHudMouseEnter, handleHudMouseLeave, beginInteractiveHudAction } =
		useLaunchHudInteractionState({
			openId,
			isHudDraggingRef,
			isWebcamPreviewDraggingRef,
			webcamPreviewDragStartRef,
		});

	const [isHudHovered, setIsHudHovered] = useState(false);

	const onHudMouseEnter = useCallback(() => {
		setIsHudHovered(true);
		handleHudMouseEnter();
	}, [handleHudMouseEnter]);

	const onHudMouseLeave = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			setIsHudHovered(false);
			handleHudMouseLeave(event);
		},
		[handleHudMouseLeave],
	);

	useEffect(() => {
		let mounted = true;

		void window.electronAPI.getSelectedSource().then(async (source) => {
			if (mounted && source) {
				syncSelectedSource(source);
				return;
			}
			// Automatically select primary screen on launch if no source is active
			try {
				const sources = await window.electronAPI.getSources({ types: ["screen"] });
				const primary = sources?.[0];
				if (mounted && primary) {
					await handleSourceSelect(primary as DesktopSource);
				}
			} catch (error) {
				console.warn("Failed to auto-select primary screen:", error);
			}
		});

		const cleanup = window.electronAPI.onSelectedSourceChanged((source) => {
			if (mounted) syncSelectedSource(source);
		});

		return () => {
			mounted = false;
			cleanup?.();
		};
	}, [handleSourceSelect, syncSelectedSource]);

	const hudStateTransition = {
		duration: 0.24,
		ease: [0.22, 1, 0.36, 1] as const,
	};

	const recordingControls = (
		<RecordingControls
			paused={paused}
			microphoneEnabled={microphoneEnabled}
			elapsed={elapsed}
			onToggleMicrophone={() => setMicrophoneEnabled(!microphoneEnabled)}
			onPauseResume={paused ? resumeRecording : pauseRecording}
			onStopRecording={toggleRecording}
			onHideHud={() => window.electronAPI?.hudOverlayHide?.()}
			onCancelRecording={cancelRecording}
			formatTime={formatTime}
		/>
	);

	const idleControls = (
		<>
			{platform !== "linux" && (
				<>
					<SourcePopover
						selectedSource={selectedSource}
						onSourceSelect={handleSourceSelect}
						onOpen={beginInteractiveHudAction}
						trigger={
							<Button
								variant="outline"
								size="lg"
								className={`${styles.electronNoDrag} group gap-2.5 px-3.5 h-10 min-w-0 max-w-[200px] rounded-2xl font-bold text-[12.5px] shrink-0 border border-white/18 bg-white/[0.08] hover:bg-white/[0.14] text-white hover:border-purple-400/50 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)] ${openId === "sources" ? "border-purple-400/60 bg-purple-500/25 shadow-[0_0_20px_rgba(168,85,247,0.35)]" : ""}`}
								title={selectedSource}
							>
								<MonitorIcon size={17} className="shrink-0 text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" weight="bold" />
								<div className="flex-1 min-w-0 overflow-hidden text-zinc-100 font-semibold tracking-wide">
									<MarqueeText text={selectedSource} />
								</div>
								<CaretUpIcon
									size={12}
									className={`text-zinc-300 group-hover:text-white ml-0.5 shrink-0 transition-transform duration-200 ${
										openId === "sources" ? "" : "rotate-180"
									}`}
								/>
							</Button>
						}
					/>

					<Separator orientation="vertical" className="mx-1 h-6 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
				</>
			)}

			<MicPopover
				disabled={recording}
				systemAudioEnabled={systemAudioEnabled}
				onToggleSystemAudio={() => setSystemAudioEnabled(!systemAudioEnabled)}
				microphoneEnabled={microphoneEnabled}
				onDisableMicrophone={() => setMicrophoneEnabled(false)}
				devices={devices}
				microphoneDeviceId={microphoneDeviceId}
				selectedDeviceId={selectedDeviceId}
				onSelectDevice={(deviceId) => {
					setMicrophoneEnabled(true);
					setSelectedDeviceId(deviceId);
					setMicrophoneDeviceId(deviceId === "default" ? undefined : deviceId);
				}}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						title={
							microphoneEnabled
								? t("recording.disableMicrophone")
								: t("recording.enableMicrophone")
						}
						className={`w-9.5 h-9.5 rounded-2xl transition-all active:scale-95 text-zinc-300 hover:text-white hover:bg-white/[0.12] ${
							microphoneEnabled
								? "text-cyan-300 bg-cyan-500/20 border border-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
								: ""
						}`}
					>
						{microphoneEnabled ? (
							<MicrophoneIcon size={18} weight="fill" />
						) : (
							<MicrophoneSlashIcon size={18} />
						)}
					</Button>
				}
			/>

			<WebcamPopover
				disabled={recording}
				webcamEnabled={webcamEnabled}
				onDisableWebcam={() => setWebcamEnabled(false)}
				canToggleFloatingPreview={canToggleFloatingWebcamPreview(
					hudOverlayMousePassthroughSupported,
				)}
				showFloatingWebcamPreview={showFloatingWebcamPreview}
				onToggleFloatingPreview={() => setShowFloatingWebcamPreview((current) => !current)}
				showWebcamControls={showWebcamControls}
				setWebcamPreviewNode={setWebcamPreviewNode}
				videoDevices={videoDevices}
				webcamDeviceId={webcamDeviceId}
				selectedVideoDeviceId={selectedVideoDeviceId}
				onSelectVideoDevice={(deviceId) => {
					setWebcamEnabled(true);
					setSelectedVideoDeviceId(deviceId);
					setWebcamDeviceId(deviceId);
				}}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						title={
							webcamEnabled
								? t("recording.disableWebcam")
								: t("recording.enableWebcam")
						}
						className={`w-9.5 h-9.5 rounded-2xl transition-all active:scale-95 text-zinc-300 hover:text-white hover:bg-white/[0.12] ${
							webcamEnabled
								? "text-purple-200 bg-purple-500/25 border border-purple-400/45 shadow-[0_0_16px_rgba(168,85,247,0.45)]"
								: ""
						}`}
					>
						{webcamEnabled ? (
							<VideoCameraIcon size={18} weight="fill" />
						) : (
							<VideoCameraSlashIcon size={18} />
						)}
					</Button>
				}
			/>

			<CountdownPopover
				countdownDelay={countdownDelay}
				onSelectDelay={setCountdownDelay}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						title={t("recording.countdownDelay")}
						className={`w-9.5 h-9.5 rounded-2xl transition-all active:scale-95 text-zinc-300 hover:text-white hover:bg-white/[0.12] ${
							countdownDelay > 0
								? "text-amber-300 bg-amber-500/20 border border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.35)]"
								: ""
						}`}
					>
						<TimerIcon size={18} weight={countdownDelay > 0 ? "fill" : "regular"} />
					</Button>
				}
			/>

			<button
				type="button"
				className={`${styles.recBtn} ${styles.electronNoDrag} mx-1`}
				onClick={async () => {
					if (hasSelectedSource || platform === "linux") {
						toggleRecording();
					} else {
						// Auto-select primary screen and start recording immediately
						try {
							const sources = await window.electronAPI.getSources({
								types: ["screen"],
							});
							const primary = sources?.[0];
							if (primary) {
								await handleSourceSelect(primary as DesktopSource);
								toggleRecording();
								return;
							}
						} catch (error) {
							console.warn("Failed to auto-select screen on record click:", error);
						}
						beginInteractiveHudAction();
						requestOpen("sources");
					}
				}}
				disabled={countdownActive}
				title={t("recording.record")}
			>
				<div className={styles.recDot} />
			</button>

			<Separator orientation="vertical" className="mx-1 h-6 bg-gradient-to-b from-transparent via-white/25 to-transparent" />

			<div className="relative w-0 h-0">
				<ProjectPopover
					entries={projectLibraryEntries}
					onOpenProject={openProjectFromLibrary}
					trigger={<div className="absolute inset-0 pointer-events-none opacity-0" />}
				/>
			</div>

			<MorePopover
				supportsHudCaptureProtection={supportsHudCaptureProtection}
				hideHudFromCapture={hideHudFromCapture}
				onToggleHudCaptureProtection={() => {
					void toggleHudCaptureProtection();
				}}
				onChooseRecordingsDirectory={() => {
					void chooseRecordingsDirectory();
				}}
				onOpenVideoFile={() => {
					void openVideoFile();
				}}
				onOpenProjectBrowser={() => {
					refreshProjectLibrary().then(() => {
						requestOpen("projects");
					});
				}}
				showDevUpdatePreview={SHOW_DEV_UPDATE_PREVIEW}
				onPreviewUpdateUi={() => {
					if (openId) requestClose(openId);
					void window.electronAPI.previewUpdateToast().catch((error) => {
						console.warn("Failed to preview update toast:", error);
					});
				}}
				appVersion={appVersion}
				onOpenLicenseModal={() => {
					setLicenseModalOpen(true);
				}}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						title={t("recording.more")}
						className="w-9.5 h-9.5 rounded-2xl text-zinc-300 hover:text-white hover:bg-white/[0.12] transition-all active:scale-95"
					>
						<DotsThreeVerticalIcon size={18} />
					</Button>
				}
			/>

			{/* Nút Vương Miện VIP PRO đẳng cấp hoàng gia */}
			<Button
				variant="ghost"
				size="icon"
				onClick={() => setLicenseModalOpen(true)}
				title={usageStats.isPro ? "Bản quyền PRO đang hoạt động" : "Kích hoạt bản quyền / Nâng cấp PRO"}
				className={`w-9.5 h-9.5 rounded-2xl transition-all active:scale-95 cursor-pointer ${
					usageStats.isPro
						? "text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.35)]"
						: "text-amber-300 bg-gradient-to-br from-amber-400/30 via-orange-500/25 to-purple-800/40 border border-amber-400/50 hover:border-amber-300 hover:bg-amber-400/35 shadow-[0_0_20px_rgba(245,158,11,0.45)] hover:scale-105"
				}`}
			>
				<CrownIcon size={18} weight="fill" className={usageStats.isPro ? "drop-shadow-[0_2px_8px_rgba(16,185,129,0.4)]" : "drop-shadow-[0_2px_8px_rgba(245,158,11,0.6)]"} />
			</Button>

			<Button
				variant="ghost"
				size="icon"
				onClick={() => window.electronAPI?.hudOverlayHide?.()}
				title={t("recording.hideHud")}
				className="w-8.5 h-8.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.12] transition-all active:scale-95"
			>
				<MinusIcon size={16} />
			</Button>

			<Button
				variant="ghost"
				size="icon"
				onClick={() => window.electronAPI?.hudOverlayClose?.()}
				title={t("recording.closeApp")}
				className="w-8.5 h-8.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20 transition-all active:scale-95"
			>
				<XIcon size={16} />
			</Button>
		</>
	);

	const finalizingControls = (
		<div className={styles.finalizingState}>
			<ArrowClockwiseIcon size={15} className={styles.finalizingSpin} />
			<div className={styles.finalizingCopy}>
				<span>{t("recording.preparing", "Preparing recording")}</span>
				<small>{t("recording.preparingSubtitle", "Opening the editor in a moment")}</small>
			</div>
		</div>
	);

	const hudMode = finalizing ? "finalizing" : recording ? "recording" : "idle";

	return (
		<HudInteractionContext.Provider
			value={{ onMouseEnter: handleHudMouseEnter, onMouseLeave: handleHudMouseLeave }}
		>
			<div
				className="w-full flex justify-center bg-transparent overflow-visible items-end pb-5 pointer-events-none"
				style={{ height: "100vh" }}
			>
				<div
					ref={hudContentRef}
					className="flex items-center overflow-visible flex-col-reverse pointer-events-none"
				>
					<div className="flex flex-col items-center pointer-events-none p-2">
						<div
							ref={hudBarTransformRef}
							className="pointer-events-none"
							style={{
								transform: `translate3d(${recordingHudOffset.x}px, ${recordingHudOffset.y}px, 0)`,
							}}
						>
							<motion.div
								ref={hudBarRef}
								data-hud-interactive
								layout={!showRecordingWebcamPreview && !isHudDragging}
								transition={hudStateTransition}
								className={`${styles.bar} ${recording ? styles.barRecording : ""} ${isHudHovered ? styles.barHovered : ""} launch-theme mb-2 pointer-events-auto`}
								onMouseEnter={onHudMouseEnter}
								onMouseLeave={onHudMouseLeave}
							>
								<div
									// On Linux (especially Wayland) the compositor owns window
									// placement, so BrowserWindow.setBounds() is silently ignored.
									// Fall back to a native OS drag via -webkit-app-region on the
									// handle.  We still need JS pointer handlers in webcam-preview
									// mode (which translates via CSS inside the window), so only
									// mark the handle as a native drag region for the IPC path.
									className={`flex items-center px-0.5 cursor-grab active:cursor-grabbing ${
										platform === "linux" && !showRecordingWebcamPreview
											? styles.electronDrag
											: ""
									}`}
									onPointerDown={handleHudBarPointerDown}
									onPointerMove={handleHudBarPointerMove}
									onPointerUp={handleHudBarPointerUp}
									onPointerCancel={handleHudBarPointerUp}
								>
									<RxDragHandleDots2 size={14} className="text-[#6b6b78]" />
								</div>

								<div className={styles.barStateViewport}>
									<AnimatePresence initial={false} mode="wait">
										<motion.div
											key={hudMode}
											layout={!showRecordingWebcamPreview && !isHudDragging}
											className={styles.barState}
											initial={{
												opacity: 0,
												y: 10,
												scale: 0.985,
												filter: "blur(8px)",
											}}
											animate={{
												opacity: 1,
												y: 0,
												scale: 1,
												filter: "blur(0px)",
											}}
											exit={{
												opacity: 0,
												y: -10,
												scale: 0.985,
												filter: "blur(6px)",
											}}
											transition={hudStateTransition}
										>
											{finalizing
												? finalizingControls
												: recording
													? recordingControls
													: idleControls}
										</motion.div>
									</AnimatePresence>
								</div>
							</motion.div>
						</div>
						{showRecordingWebcamPreview && (
							<div
								ref={recordingWebcamPreviewContainerRef}
								className={`${styles.recordingWebcamPreview} ${styles.electronNoDrag} pointer-events-auto`}
								data-hud-interactive
								title={t("recording.webcam")}
								style={{
									transform: `translate(${webcamPreviewOffset.x}px, ${webcamPreviewOffset.y}px)`,
								}}
								onMouseEnter={handleHudMouseEnter}
								onMouseLeave={handleHudMouseLeave}
								onPointerDown={handleWebcamPreviewPointerDown}
								onPointerMove={handleWebcamPreviewPointerMove}
								onPointerUp={handleWebcamPreviewPointerUp}
								onPointerCancel={handleWebcamPreviewPointerUp}
							>
								<video
									ref={setRecordingWebcamPreviewNode}
									className={styles.recordingWebcamPreviewVideo}
									muted
									playsInline
									style={{ transform: "scaleX(-1)" }}
								/>
							</div>
						)}
					</div>
				</div>
			</div>

			<LicenseModal
				open={licenseModalOpen}
				onOpenChange={setLicenseModalOpen}
			/>
		</HudInteractionContext.Provider>
	);
}
