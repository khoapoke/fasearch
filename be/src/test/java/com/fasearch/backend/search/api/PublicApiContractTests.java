package com.fasearch.backend.search.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class PublicApiContractTests {

	@Test
	void catalogImageUnavailableIsDeclaredAsAnApiError() throws IOException {
		var contract = new tools.jackson.databind.json.JsonMapper().readTree(
				Files.readString(Path.of("..", "contracts", "public-api.openapi.json")));
		assertThat(contract.at("/paths/~1api~1v1~1catalog~1images~1{productId}~1{productVersionId}/get/responses/503/$ref")
				.asText()).isEqualTo("#/components/responses/SearchError");
	}

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
				.contains("\"/api/v1/catalog/products\"")
				.contains("\"/api/v1/catalog/products/{productId}\"")
				.contains("\"CatalogPageResponse\"")
				.contains("\"CatalogDetail\"")
				.contains("\"CATALOG_SNAPSHOT_MISMATCH\"")
				.contains("\"multipart/form-data\"")
				.contains("\"maximum\": 100")
				.contains("\"ImageSearchResponse\"")
				.contains("\"CATALOG_VERSION_MISMATCH\"");
	}

	@Test
	void checkedInContractDeclaresThePersonalLibrarySurface() throws IOException {
		Path contractPath = Path.of("..", "contracts", "public-api.openapi.json");
		String contract = Files.readString(contractPath);

		assertThat(contract)
				.contains("\"/api/v1/me/saved-products\"")
				.contains("\"/api/v1/me/saved-products/{productId}\"")
				.contains("\"/api/v1/me/search-history\"")
				.contains("\"/api/v1/me/search-history/{entryId}\"")
				.contains("\"/api/v1/me/library-preferences\"")
				.contains("\"SavedProductsPage\"")
				.contains("\"SearchHistoryPage\"")
				.contains("\"LibraryPreferences\"")
				.contains("\"X-History-Status\"")
				.contains("PRODUCT_NOT_FOUND")
				.contains("HISTORY_NOT_FOUND");
	}
}
