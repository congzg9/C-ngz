import fs from "node:fs/promises";
import path from "node:path";
import Jimp from "jimp";

const sourceImagePath = "C:/Users/cong/.gemini/antigravity-ide/brain/72cd9ff6-66af-4295-8d22-0ecb9f9b8836/app_icon_minimal_vector_1791387381725.jpg";

async function buildIco(pngBuffersBySize) {
	// pngBuffersBySize: Array of { width: number, height: number, buffer: Buffer }
	const count = pngBuffersBySize.length;
	const headerSize = 6;
	const entrySize = 16;
	let currentOffset = headerSize + count * entrySize;

	const header = Buffer.alloc(headerSize);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // ICO type
	header.writeUInt16LE(count, 4); // count

	const entries = [];
	for (const img of pngBuffersBySize) {
		const entry = Buffer.alloc(entrySize);
		entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
		entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
		entry.writeUInt8(0, 2); // color count
		entry.writeUInt8(0, 3); // reserved
		entry.writeUInt16LE(1, 4); // planes
		entry.writeUInt16LE(32, 6); // bit count
		entry.writeUInt32LE(img.buffer.length, 8); // size
		entry.writeUInt32LE(currentOffset, 12); // offset
		entries.push(entry);
		currentOffset += img.buffer.length;
	}

	return Buffer.concat([header, ...entries, ...pngBuffersBySize.map((img) => img.buffer)]);
}

async function main() {
	console.log("Loading source icon:", sourceImagePath);
	const image = await Jimp.read(sourceImagePath);

	const allSizes = [1024, 512, 256, 128, 64, 48, 32, 24, 16];
	const pngBuffers = {};

	for (const size of allSizes) {
		const clone = image.clone();
		clone.resize(size, size, Jimp.RESIZE_BICUBIC);
		const buffer = await clone.getBufferAsync(Jimp.MIME_PNG);
		pngBuffers[size] = buffer;

		// Write to icons/icons/png/
		await fs.mkdir("icons/icons/png", { recursive: true });
		await fs.writeFile(`icons/icons/png/${size}x${size}.png`, buffer);

		// Write to public/app-icons/
		await fs.mkdir("public/app-icons", { recursive: true });
		if ([1024, 512, 256, 128, 64, 32, 16].includes(size)) {
			await fs.writeFile(`public/app-icons/recordly-${size}.png`, buffer);
			await fs.writeFile(`public/app-icons/recordlymac-${size}.png`, buffer);
		}
	}

	// Build .ico with sizes 256, 128, 64, 48, 32, 16
	const icoSizes = [256, 128, 64, 48, 32, 16];
	const icoImages = icoSizes.map((size) => ({
		width: size,
		height: size,
		buffer: pngBuffers[size],
	}));

	const icoBuffer = await buildIco(icoImages);
	await fs.mkdir("icons/icons/win", { recursive: true });
	await fs.writeFile("icons/icons/win/icon.ico", icoBuffer);

	console.log("App icons successfully updated across all directories!");
}

main().catch(console.error);
