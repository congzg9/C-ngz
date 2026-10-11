export const EXPORT_BLOB_STREAM_CHUNK_BYTES = 16 * 1024 * 1024;

export async function streamExportBlobToTempFile(
	blob: Blob,
	extension: string,
): Promise<string | null> {
	if (
		typeof window === "undefined" ||
		!window.electronAPI?.openExportStream ||
		!window.electronAPI?.writeExportStreamChunk ||
		!window.electronAPI?.closeExportStream
	) {
		return null;
	}

	const openResult = await window.electronAPI.openExportStream({ extension });
	if (!openResult.success || !openResult.streamId || !openResult.tempPath) {
		throw new Error(openResult.error || "Failed to open export stream");
	}

	const { streamId } = openResult;
	let position = 0;

	try {
		while (position < blob.size) {
			const chunk = blob.slice(position, position + EXPORT_BLOB_STREAM_CHUNK_BYTES);
			const chunkBuffer = await chunk.arrayBuffer();
			const writeResult = await window.electronAPI.writeExportStreamChunk(
				streamId,
				position,
				new Uint8Array(chunkBuffer),
			);
			if (!writeResult.success) {
				throw new Error(writeResult.error || "Failed to write export stream chunk");
			}
			position += chunkBuffer.byteLength;
		}

		const closeResult = await window.electronAPI.closeExportStream(streamId);
		if (!closeResult.success || !closeResult.tempPath) {
			throw new Error(closeResult.error || "Failed to close export stream");
		}

		return closeResult.tempPath;
	} catch (error) {
		try {
			await window.electronAPI.closeExportStream(streamId, { abort: true });
		} catch {
			// Best-effort cleanup; preserve the original error below.
		}
		throw error;
	}
}
