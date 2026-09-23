package com.fasearch.backend.search.infrastructure.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.CatalogProductReader.Key;

class FixtureCatalogProductAdapterTests {

	@TempDir
	Path directory;

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
