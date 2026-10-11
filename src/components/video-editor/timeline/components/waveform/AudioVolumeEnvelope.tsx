export interface AudioVolumeEnvelopeProps {
	volume: number; // 0 to 1
	fadeInMs?: number;
	fadeOutMs?: number;
	durationMs: number;
	isSelected?: boolean;
	muted?: boolean;
}

export function AudioVolumeEnvelope({
	volume = 1,
	fadeInMs = 0,
	fadeOutMs = 0,
	durationMs = 1000,
	isSelected = false,
	muted = false,
}: AudioVolumeEnvelopeProps) {
	// Chỉ hiển thị đường trắng và nét mờ khi bấm chọn đoạn âm thanh để chỉnh âm hoặc chỉnh mịn
	if (!isSelected) {
		return null;
	}

	const vol = muted ? 0 : Math.max(0, Math.min(1, volume));
	const dur = Math.max(1, durationMs);

	// y=88 is 0% volume baseline, y=44 is 100% volume line (middle)
	const baseY = 88;
	const maxVolumeY = 44;
	const volumeY = baseY - vol * (baseY - maxVolumeY);

	let inPct = Math.min(100, Math.max(0, ((fadeInMs ?? 0) / dur) * 100));
	let outPct = Math.min(100, Math.max(0, ((fadeOutMs ?? 0) / dur) * 100));
	if (inPct + outPct > 100) {
		const sum = inPct + outPct;
		inPct = (inPct / sum) * 100;
		outPct = (outPct / sum) * 100;
	}

	const hasFadeIn = inPct > 0.5;
	const hasFadeOut = outPct > 0.5;
	const rightX = 100 - outPct;

	// Control points for smooth S-curve easing (bo cong mượt mà)
	const inCp1x = inPct * 0.42;
	const inCp1y = baseY;
	const inCp2x = inPct * 0.58;
	const inCp2y = volumeY;

	const outCp1x = rightX + outPct * 0.42;
	const outCp1y = volumeY;
	const outCp2x = rightX + outPct * 0.58;
	const outCp2y = baseY;

	// Smooth curved line path
	const linePath = [
		hasFadeIn
			? `M 0,${baseY.toFixed(2)} C ${inCp1x.toFixed(2)},${inCp1y.toFixed(2)} ${inCp2x.toFixed(2)},${inCp2y.toFixed(2)} ${inPct.toFixed(2)},${volumeY.toFixed(2)}`
			: `M 0,${volumeY.toFixed(2)}`,
		`L ${rightX.toFixed(2)},${volumeY.toFixed(2)}`,
		hasFadeOut
			? `C ${outCp1x.toFixed(2)},${outCp1y.toFixed(2)} ${outCp2x.toFixed(2)},${outCp2y.toFixed(2)} 100,${baseY.toFixed(2)}`
			: `L 100,${volumeY.toFixed(2)}`,
	].join(" ");

	// Shaded wedge above fade-in (nét mờ đầu - bo cong)
	const fadeInShadePath = hasFadeIn
		? `M 0,0 L ${inPct.toFixed(2)},0 L ${inPct.toFixed(2)},${volumeY.toFixed(2)} C ${inCp2x.toFixed(2)},${inCp2y.toFixed(2)} ${inCp1x.toFixed(2)},${inCp1y.toFixed(2)} 0,${baseY.toFixed(2)} Z`
		: "";

	// Shaded wedge above fade-out (nét mờ cuối - bo cong)
	const fadeOutShadePath = hasFadeOut
		? `M ${rightX.toFixed(2)},0 L 100,0 L 100,${baseY.toFixed(2)} C ${outCp2x.toFixed(2)},${outCp2y.toFixed(2)} ${outCp1x.toFixed(2)},${outCp1y.toFixed(2)} ${rightX.toFixed(2)},${volumeY.toFixed(2)} Z`
		: "";

	// Translucent highlight ramp under fade-in
	const fadeInUnderPath = hasFadeIn
		? `M 0,${baseY.toFixed(2)} C ${inCp1x.toFixed(2)},${inCp1y.toFixed(2)} ${inCp2x.toFixed(2)},${inCp2y.toFixed(2)} ${inPct.toFixed(2)},${volumeY.toFixed(2)} L ${inPct.toFixed(2)},${baseY.toFixed(2)} Z`
		: "";

	// Translucent highlight ramp under fade-out
	const fadeOutUnderPath = hasFadeOut
		? `M ${rightX.toFixed(2)},${baseY.toFixed(2)} L ${rightX.toFixed(2)},${volumeY.toFixed(2)} C ${outCp1x.toFixed(2)},${outCp1y.toFixed(2)} ${outCp2x.toFixed(2)},${outCp2y.toFixed(2)} 100,${baseY.toFixed(2)} Z`
		: "";

	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
			<svg
				className="w-full h-full pointer-events-none"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
			>
				<defs>
					{/* Dark translucent gradient for fade-in attenuation (nét mờ) */}
					<linearGradient id="fade-in-shade" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#000000" stopOpacity="0.48" />
						<stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
					</linearGradient>
					{/* Dark translucent gradient for fade-out attenuation (nét mờ) */}
					<linearGradient id="fade-out-shade" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#000000" stopOpacity="0.12" />
						<stop offset="100%" stopColor="#000000" stopOpacity="0.48" />
					</linearGradient>
					{/* Subtle luminous highlight under ramp */}
					<linearGradient id="fade-ramp-fill" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
						<stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
					</linearGradient>
				</defs>

				{/* Fade In Shaded Wedge (attenuated zone with smooth curve) */}
				{hasFadeIn && <path d={fadeInShadePath} fill="url(#fade-in-shade)" stroke="none" />}

				{/* Fade In Under-ramp Highlight */}
				{hasFadeIn && (
					<path d={fadeInUnderPath} fill="url(#fade-ramp-fill)" stroke="none" />
				)}

				{/* Fade Out Shaded Wedge (attenuated zone with smooth curve) */}
				{hasFadeOut && (
					<path d={fadeOutShadePath} fill="url(#fade-out-shade)" stroke="none" />
				)}

				{/* Fade Out Under-ramp Highlight */}
				{hasFadeOut && (
					<path d={fadeOutUnderPath} fill="url(#fade-ramp-fill)" stroke="none" />
				)}

				{/* Fade In boundary dashed guideline */}
				{hasFadeIn && (
					<line
						x1={inPct.toFixed(2)}
						y1="0"
						x2={inPct.toFixed(2)}
						y2="100"
						stroke="rgba(255, 255, 255, 0.5)"
						strokeDasharray="2,2"
						strokeWidth="1"
						vectorEffect="non-scaling-stroke"
					/>
				)}

				{/* Fade Out boundary dashed guideline */}
				{hasFadeOut && (
					<line
						x1={rightX.toFixed(2)}
						y1="0"
						x2={rightX.toFixed(2)}
						y2="100"
						stroke="rgba(255, 255, 255, 0.5)"
						strokeDasharray="2,2"
						strokeWidth="1"
						vectorEffect="non-scaling-stroke"
					/>
				)}

				{/* Volume Baseline / Envelope Path (Smooth Bezier Line) */}
				<path
					d={linePath}
					fill="none"
					stroke="#ffffff"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
					style={{
						filter: "drop-shadow(0 1px 2.5px rgba(0, 0, 0, 0.7))",
					}}
				/>
			</svg>

			{/* Keyframe handle at Fade In end */}
			{hasFadeIn && (
				<div
					className="absolute w-2 h-2 rounded-full bg-white border border-black/60 shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[6]"
					style={{ left: `${inPct}%`, top: `${volumeY}%` }}
				/>
			)}

			{/* Fade In duration label */}
			{hasFadeIn && inPct >= 8 && (
				<div
					className="absolute left-1 text-[8.5px] font-mono font-medium text-white/80 bg-black/40 px-1 py-0.2 rounded pointer-events-none z-[6] select-none"
					style={{ top: "18%" }}
				>
					{(fadeInMs / 1000).toFixed(1)}s
				</div>
			)}

			{/* Keyframe handle at Fade Out start */}
			{hasFadeOut && (
				<div
					className="absolute w-2 h-2 rounded-full bg-white border border-black/60 shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[6]"
					style={{ left: `${rightX}%`, top: `${volumeY}%` }}
				/>
			)}

			{/* Fade Out duration label */}
			{hasFadeOut && outPct >= 8 && (
				<div
					className="absolute right-1 text-[8.5px] font-mono font-medium text-white/80 bg-black/40 px-1 py-0.2 rounded pointer-events-none z-[6] select-none"
					style={{ top: "18%" }}
				>
					{(fadeOutMs / 1000).toFixed(1)}s
				</div>
			)}

			{/* Volume label badge when selected */}
			<div
				className="absolute right-1.5 text-[9px] font-mono font-semibold tracking-tight text-white bg-black/70 backdrop-blur-xs px-1.5 py-0.5 rounded shadow pointer-events-none z-[7] -translate-y-1/2 select-none border border-white/20"
				style={{ top: `${volumeY}%` }}
			>
				{Math.round(vol * 100)}%
			</div>
		</div>
	);
}

export default AudioVolumeEnvelope;
