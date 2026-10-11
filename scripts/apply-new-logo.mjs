import fs from "node:fs/promises";
import Jimp from "jimp";

const sourcePath = "C:/Users/cong/.gemini/antigravity-ide/brain/f5d90bd8-fe1c-4fd2-8324-6d5a97271410/logo_concept_2_notext_1791646468950.jpg";

async function buildIco(pngBuffersBySize) {
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

async function run() {
	console.log("Reading source image:", sourcePath);
	const rawImg = await Jimp.read(sourcePath);

	// Crop to the squircle region:
	// From x: 196, y: 196 to width: 632, height: 632 (centered at (512, 512))
	const cropSize = 630;
	const startX = Math.round(512 - cropSize / 2);
	const startY = Math.round(512 - cropSize / 2);

	const cropped = rawImg.clone().crop(startX, startY, cropSize, cropSize);

	// Create rounded squircle mask with corner radius ~140px on 630px canvas
	const mask = new Jimp(cropSize, cropSize, 0x00000000);
	const r = 145; // corner radius
	for (let y = 0; y < cropSize; y++) {
		for (let x = 0; x < cropSize; x++) {
			let inside = true;
			// Check 4 corners
			if (x < r && y < r) {
				const dx = r - x;
				const dy = r - y;
				if (dx * dx + dy * dy > r * r) inside = false;
			} else if (x > cropSize - r && y < r) {
				const dx = x - (cropSize - r);
				const dy = r - y;
				if (dx * dx + dy * dy > r * r) inside = false;
			} else if (x < r && y > cropSize - r) {
				const dx = r - x;
				const dy = y - (cropSize - r);
				if (dx * dx + dy * dy > r * r) inside = false;
			} else if (x > cropSize - r && y > cropSize - r) {
				const dx = x - (cropSize - r);
				const dy = y - (cropSize - r);
				if (dx * dx + dy * dy > r * r) inside = false;
			}
			if (inside) {
				mask.setPixelColor(0xFFFFFFFF, x, y);
			}
		}
	}

	cropped.mask(mask, 0, 0);

	// Resize to 1024x1024 master icon
	const masterIcon = cropped.clone().resize(1024, 1024, Jimp.RESIZE_BICUBIC);

	// Save master png to public/
	await fs.mkdir("public", { recursive: true });
	await masterIcon.writeAsync("public/app-icon.png");
	await masterIcon.writeAsync("paypal-license-server/public/app-icon.png");

	const allSizes = [1024, 512, 256, 128, 64, 48, 32, 24, 16];
	const pngBuffers = {};

	for (const size of allSizes) {
		const clone = masterIcon.clone();
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

	console.log("Successfully generated all icons for Windows & Web from Concept 2 without text!");
}

run().catch(console.error);
