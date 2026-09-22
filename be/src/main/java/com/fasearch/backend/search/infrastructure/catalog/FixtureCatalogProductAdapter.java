package com.fasearch.backend.search.infrastructure.catalog;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.CatalogProductReader;

@Component
@Profile({ "local", "test" })
public final class FixtureCatalogProductAdapter implements CatalogProductReader {

	private final Map<Key, Product> products;

	public FixtureCatalogProductAdapter(FaSearchProperties properties, JsonMapper jsonMapper) {
		Map<Key, Product> configured = new LinkedHashMap<>();
		String fixtureFile = properties.catalog().file();
		if (fixtureFile != null && !fixtureFile.isBlank()) {
			loadFile(Path.of(fixtureFile), jsonMapper, configured);
		}
		for (FaSearchProperties.Product item : properties.catalog().products()) {
			Product product = new Product(
					item.productId(),
					item.productVersionId(),
					item.title(),
					item.category(),
					item.imageUrl());
			configured.put(product.key(), product);
		}
		this.products = Map.copyOf(configured);
	}

	private static void loadFile(
			Path path,
			JsonMapper jsonMapper,
			Map<Key, Product> configured) {
		try {
			for (String line : Files.readAllLines(path)) {
				if (line.isBlank()) {
					continue;
				}
				FixtureRecord item = jsonMapper.readValue(line, FixtureRecord.class);
				Product product = new Product(
						item.productId(),
						item.productVersionId(),
						item.title(),
						item.category(),
						"/demo/products/placeholder.svg");
				configured.put(product.key(), product);
			}
		}
		catch (IOException exception) {
			throw new IllegalStateException("Could not load local catalog fixture", exception);
		}
	}

	@Override
	public Map<Key, Product> findActive(Collection<Key> requested) {
		Map<Key, Product> found = new LinkedHashMap<>();
		for (Key key : requested) {
			Product product = products.get(key);
			if (product != null) {
				found.put(key, product);
			}
		}
		return Map.copyOf(found);
	}

	private record FixtureRecord(
			@JsonProperty("product_id") String productId,
			@JsonProperty("product_version_id") String productVersionId,
			String title,
			String category) {
	}
}
