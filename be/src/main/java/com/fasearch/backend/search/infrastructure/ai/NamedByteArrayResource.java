package com.fasearch.backend.search.infrastructure.ai;

import org.springframework.core.io.ByteArrayResource;

/** Query image bytes with a stable multipart filename. */
final class NamedByteArrayResource extends ByteArrayResource {

	private final String filename;

	NamedByteArrayResource(byte[] bytes, String filename) {
		super(bytes);
		this.filename = filename == null || filename.isBlank() ? "query-image" : filename;
	}

	@Override
	public String getFilename() {
		return filename;
	}
}
