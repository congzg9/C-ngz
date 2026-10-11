import { toast } from "sonner";

export const EXPORT_ERROR_TOAST_DURATION_MS = 20000;

export function cloneStructured<T>(value: T): T {
	return globalThis.structuredClone(value);
}

export type SaveProjectOptions = {
	silent?: boolean;
	remountPreviewAfterSave?: boolean;
	refreshLibraryAfterSave?: boolean;
	captureThumbnail?: boolean;
};

export function summarizeErrorMessage(message: string): string {
	const firstLine = message
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	return firstLine ?? message;
}

export function showExportErrorToast(message: string) {
	const summary = summarizeErrorMessage(message);
	toast.error(summary, {
		description: summary === message ? undefined : message,
		duration: EXPORT_ERROR_TOAST_DURATION_MS,
	});
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error.replace(/^Error:\s*/i, "");
	}

	return "Something went wrong";
}

export function isComparableObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function areDeepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) {
		return true;
	}

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
			return false;
		}

		for (let index = 0; index < left.length; index += 1) {
			if (!areDeepEqual(left[index], right[index])) {
				return false;
			}
		}

		return true;
	}

	if (!isComparableObject(left) || !isComparableObject(right)) {
		return false;
	}

	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}

	for (const key of leftKeys) {
		if (!(key in right) || !areDeepEqual(left[key], right[key])) {
			return false;
		}
	}

	return true;
}
