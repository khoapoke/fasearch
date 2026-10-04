package com.fasearch.backend.search.infrastructure.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.CatalogProductReader.Key;
import com.fasearch.backend.search.application.SearchException;

class FixtureCatalogProductAdapterTests {

	@TempDir
	Path directory;

	@Test
	void missingOrMalformedConfiguredFileDoesNotPreventStartupOrFallBack() throws Exception {
		Path malformed = directory.resolve("malformed.jsonl");
		Files.writeString(malformed, "not-json");
		for (Path file : List.of(directory.resolve("missing.jsonl"), malformed)) {
			FaSearchProperties properties = new FaSearchProperties(null, null,
					new FaSearchProperties.Catalog(file.toString(), List.of()));
			FixtureCatalogProductAdapter adapter = new FixtureCatalogProductAdapter(properties, new JsonMapper());
			assertThatThrownBy(() -> adapter.findActive(List.of(new Key("p1", "p1-v1"))))
					.isInstanceOf(SearchException.class)
					.extracting(exception -> ((SearchException) exception).code())
					.isEqualTo("CATALOG_UNAVAILABLE");
			assertThatThrownBy(() -> adapter.findActiveImage(new Key("p1", "p1-v1")))
					.isInstanceOf(SearchException.class);
		}
	}

	@Test
	void configuredFileCannotBeOverlaidWithDefaultProducts() throws Exception {
		Path catalog = directory.resolve("catalog.jsonl");
		Files.writeString(catalog, """
				{"product_id":"p1","product_version_id":"p1-v1","title":"Publication title","category":"TOP","image_path":"%s"}
				""".formatted(directory.resolve("p1.jpg")));
		FaSearchProperties properties = new FaSearchProperties(null, null,
				new FaSearchProperties.Catalog(catalog.toString(), List.of(
						new FaSearchProperties.Product("p1", "p1-v1", "Overlay title", "TOP", "/overlay"),
						new FaSearchProperties.Product("overlay", "overlay-v1", "Overlay", "TOP", "/overlay"))));
		FixtureCatalogProductAdapter adapter = new FixtureCatalogProductAdapter(properties, new JsonMapper());
		var found = adapter.findActive(List.of(new Key("p1", "p1-v1"), new Key("overlay", "overlay-v1")));
		assertThat(found).hasSize(1);
		assertThat(found.get(new Key("p1", "p1-v1")).title()).isEqualTo("Publication title");
	}

	@Test
	void servesOnlyAnIndexedProductVersionWithItsCatalogImage() throws Exception {
		Path image = directory.resolve("product.jpg");
		byte[] bytes = new byte[] { (byte) 0xff, (byte) 0xd8, 1, 2, (byte) 0xff, (byte) 0xd9 };
		Files.write(image, bytes);
		Path catalog = directory.resolve("catalog.jsonl");
		Files.writeString(catalog, """
				{"product_id":"p1","product_version_id":"p1-v1","title":"Áo đỏ","category":"TOP","image_path":"%s"}
				""".formatted(image));
		FaSearchProperties properties = new FaSearchProperties(
				null,
				null,
				new FaSearchProperties.Catalog(catalog.toString(), List.of()));
		FixtureCatalogProductAdapter adapter = new FixtureCatalogProductAdapter(
				properties, JsonMapper.builder().build());

		Key active = new Key("p1", "p1-v1");
		assertThat(adapter.findActive(List.of(active)).get(active).imageUrl())
				.isEqualTo("/api/catalog/images/p1/p1-v1");
		assertThat(adapter.findActiveImage(active)).get()
				.satisfies(found -> {
					assertThat(found.contentType()).isEqualTo("image/jpeg");
					assertThat(found.content()).containsExactly(bytes);
				});
		assertThat(adapter.findActiveImage(new Key("p1", "p1-v2"))).isEmpty();
		assertThat(adapter.findActiveImage(new Key("unknown", "unknown-v1"))).isEmpty();
	}
}
