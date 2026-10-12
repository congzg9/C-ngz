import { type MouseEvent, type RefObject, useCallback, useEffect, useRef } from "react";

export function useLaunchHudInteractionState({
	openId,
	recording = false,
	countdownActive = false,
	isHudDraggingRef,
	isWebcamPreviewDraggingRef,
	webcamPreviewDragStartRef,
}: {
	openId: string | null;
	recording?: boolean;
	countdownActive?: boolean;
	isHudDraggingRef: RefObject<boolean>;
	isWebcamPreviewDraggingRef: RefObject<boolean>;
	webcamPreviewDragStartRef: RefObject<unknown>;
}) {
	const isMouseOverHudRef = useRef(false);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (recording || countdownActive) {
			isMouseOverHudRef.current = false;
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
		}
	}, [recording, countdownActive]);

	useEffect(() => {
		if (openId !== null) {
			window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
		} else {
			// Proactively check if we should ignore mouse when popover closes
			setTimeout(() => {
				if (!isMouseOverHudRef.current) {
					window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
				}
			}, 150);
		}
	}, [openId]);

	useEffect(() => {
		const isInteractiveTarget = (target: HTMLElement | null) => {
			if (!target) return false;
			return !!target.closest(
				"[data-hud-interactive], [data-radix-popper-content-wrapper], [data-radix-dialog-content], [data-radix-dialog-overlay], [role='dialog'], [role='alertdialog']",
			);
		};

		const handleMouseOver = (e: globalThis.MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target) return;
			const isInteractive = isInteractiveTarget(target);

			if (isInteractive) {
				isMouseOverHudRef.current = true;
				if (timeoutRef.current) clearTimeout(timeoutRef.current);
				window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
			} else {
				isMouseOverHudRef.current = false;
				if (timeoutRef.current) clearTimeout(timeoutRef.current);
				timeoutRef.current = setTimeout(() => {
					if (
						!isHudDraggingRef.current &&
						!isWebcamPreviewDraggingRef.current &&
						!webcamPreviewDragStartRef.current &&
						!isMouseOverHudRef.current &&
						openId === null
					) {
						window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
					}
				}, 40);
			}
		};

		const handleMouseMove = (e: globalThis.MouseEvent) => {
			if (
				!isHudDraggingRef.current &&
				!isWebcamPreviewDraggingRef.current &&
				!webcamPreviewDragStartRef.current &&
				openId === null
			) {
				const target = e.target as HTMLElement | null;
				if (!isInteractiveTarget(target) && isMouseOverHudRef.current) {
					isMouseOverHudRef.current = false;
					if (timeoutRef.current) clearTimeout(timeoutRef.current);
					window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
				}
			}
		};

		window.addEventListener("mouseover", handleMouseOver);
		window.addEventListener("mousemove", handleMouseMove, { passive: true });
		return () => {
			window.removeEventListener("mouseover", handleMouseOver);
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, [isHudDraggingRef, isWebcamPreviewDraggingRef, webcamPreviewDragStartRef, openId]);

	const beginInteractiveHudAction = useCallback(() => {
		isMouseOverHudRef.current = true;
		window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
	}, []);

	const handleHudMouseEnter = useCallback(() => {
		isMouseOverHudRef.current = true;
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
	}, []);

	const handleHudMouseLeave = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			const nextTarget = event.relatedTarget;
			if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
				return;
			}

			isMouseOverHudRef.current = false;

			if (timeoutRef.current) clearTimeout(timeoutRef.current);

			timeoutRef.current = setTimeout(() => {
				if (
					!isHudDraggingRef.current &&
					!isWebcamPreviewDraggingRef.current &&
					!webcamPreviewDragStartRef.current &&
					!isMouseOverHudRef.current &&
					openId === null
				) {
					window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
				}
			}, 40);
		},
		[isHudDraggingRef, isWebcamPreviewDraggingRef, webcamPreviewDragStartRef, openId],
	);

	return {
		handleHudMouseEnter,
		handleHudMouseLeave,
		beginInteractiveHudAction,
	};
}
