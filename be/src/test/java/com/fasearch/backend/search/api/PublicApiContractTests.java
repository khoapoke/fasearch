package com.fasearch.backend.search.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class PublicApiContractTests {

	@Test
	void checkedInContractContainsTheImplementedImageSearchSurface() throws IOException {
		Path contractPath = Path.of("..", "contracts", "public-api.openapi.json");
		String contract = Files.readString(contractPath);

		assertThat(contract)
				.contains("\"/api/v1/search/image\"")
				.contains("\"/api/v1/auth/csrf\"")
				.contains("\"/api/v1/catalog/admin/drafts\"")
				.contains("\"/api/v1/catalog/admin/drafts/{productId}/image\"")
				.contains("\"/api/v1/catalog/images/{productId}/{productVersionId}\"")
				.contains("\"multipart/form-data\"")
				.contains("\"maximum\": 100")
				.contains("\"ImageSearchResponse\"")
				.contains("\"CATALOG_VERSION_MISMATCH\"");
	}
}
