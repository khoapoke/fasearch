package com.fasearch.backend.search.application;

import java.util.Optional;

public interface CatalogImageReader {

	Optional<Image> findActiveImage(CatalogProductReader.Key product);

	record Image(byte[] content, String contentType) {
	}
}
