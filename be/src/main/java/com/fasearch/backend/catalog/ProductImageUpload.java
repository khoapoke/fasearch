package com.fasearch.backend.catalog;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Iterator;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;

import org.springframework.http.HttpStatus;

public final class ProductImageUpload {

	public static final int MAX_BYTES = 10 * 1024 * 1024;

	private ProductImageUpload() {
	}

	public static ImageType inspect(byte[] bytes) {
		if (bytes.length == 0) {
			throw invalid();
		}
		if (bytes.length > MAX_BYTES) {
			throw new CatalogDraftException("IMAGE_TOO_LARGE", HttpStatus.CONTENT_TOO_LARGE,
					"Product image exceeds 10 MiB");
		}
		if (startsWith(bytes, new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff})) {
			checkDimensions(bytes);
			return new ImageType("image/jpeg", "jpg");
		}
		if (startsWith(bytes, new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47,
				0x0d, 0x0a, 0x1a, 0x0a})) {
			checkDimensions(bytes);
			return new ImageType("image/png", "png");
		}
		if (bytes.length >= 20 && startsWith(bytes, new byte[] {'R', 'I', 'F', 'F'})
				&& Arrays.equals(Arrays.copyOfRange(bytes, 8, 12), new byte[] {'W', 'E', 'B', 'P'})
				&& riffLength(bytes) == bytes.length - 8L
				&& (chunk(bytes, "VP8 ") || chunk(bytes, "VP8L") || chunk(bytes, "VP8X"))) {
			return new ImageType("image/webp", "webp");
		}
		throw invalid();
	}

	private static void checkDimensions(byte[] bytes) {
		try (ImageInputStream stream = new MemoryCacheImageInputStream(
				new ByteArrayInputStream(bytes))) {
			Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
			if (!readers.hasNext()) {
				throw invalid();
			}
			ImageReader reader = readers.next();
			try {
				reader.setInput(stream, true, true);
				int width = reader.getWidth(0);
				int height = reader.getHeight(0);
				if (width < 1 || height < 1 || width > 8192 || height > 8192
						|| (long) width * height > 40_000_000) {
					throw invalid();
				}
			}
			finally {
				reader.dispose();
			}
		}
		catch (IOException exception) {
			throw invalid();
		}
	}

	private static long riffLength(byte[] bytes) {
		return Integer.toUnsignedLong((bytes[4] & 0xff) | (bytes[5] & 0xff) << 8
				| (bytes[6] & 0xff) << 16 | (bytes[7] & 0xff) << 24);
	}

	private static boolean chunk(byte[] bytes, String name) {
		return Arrays.equals(Arrays.copyOfRange(bytes, 12, 16),
				name.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
	}

	private static boolean startsWith(byte[] bytes, byte[] prefix) {
		return bytes.length >= prefix.length
				&& Arrays.equals(Arrays.copyOf(bytes, prefix.length), prefix);
	}

	private static CatalogDraftException invalid() {
		return new CatalogDraftException("INVALID_IMAGE", HttpStatus.BAD_REQUEST,
				"Only JPEG, PNG or WebP product images are accepted");
	}

	public record ImageType(String mediaType, String extension) {
	}
}
