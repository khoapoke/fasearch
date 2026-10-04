package com.fasearch.backend.search.infrastructure.catalog;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.CatalogImageReader;
import com.fasearch.backend.search.application.CatalogProductReader;
import com.fasearch.backend.search.application.SearchException;

@Component
@Profile({ "local", "test" })
public final class FixtureCatalogProductAdapter implements CatalogProductReader, CatalogImageReader {

	private final Map<Key, Product> products;
	private final Map<Key, Path> imagePaths;
	private final boolean unavailable;

	public FixtureCatalogProductAdapter(FaSearchProperties properties, JsonMapper jsonMapper) {
		Map<Key, Product> configured = new LinkedHashMap<>();
		Map<Key, Path> configuredPaths = new LinkedHashMap<>();
		String fixtureFile = properties.catalog().file();
		boolean configuredFile = fixtureFile != null && !fixtureFile.isBlank();
		boolean failed = false;
		if (configuredFile) {
			try {
				loadFile(Path.of(fixtureFile), jsonMapper, configured, configuredPaths);
			}
			catch (RuntimeException exception) {
				// Keep startup available; reads fail closed, never serving defaults.
				failed = true;
				configured.clear();
				configuredPaths.clear();
			}
		}
		for (FaSearchProperties.Product item : configuredFile ? java.util.List.<FaSearchProperties.Product>of()
				: properties.catalog().products()) {
			Product product = new Product(
					item.productId(),
					item.productVersionId(),
					item.title(),
					item.category(),
					item.imageUrl());
			configured.put(product.key(), product);
		}
		this.products = Map.copyOf(configured);
		this.imagePaths = Map.copyOf(configuredPaths);
		this.unavailable = failed;
	}

	private void requireAvailable() {
		if (unavailable) {
			throw new SearchException("CATALOG_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
					"Catalog publication is not available");
		}
	}

	private static void loadFile(
			Path path,
			JsonMapper jsonMapper,
			Map<Key, Product> configured,
			Map<Key, Path> imagePaths) {
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
						"/api/catalog/images/" + item.productId() + "/" + item.productVersionId());
				configured.put(product.key(), product);
				imagePaths.put(product.key(), Path.of(item.imagePath()));
			}
		}
		catch (IOException exception) {
			throw new IllegalStateException("Could not load local catalog fixture", exception);
		}
	}

	@Override
	public Map<Key, Product> findActive(Collection<Key> requested) {
		requireAvailable();
		Map<Key, Product> found = new LinkedHashMap<>();
		for (Key key : requested) {
			Product product = products.get(key);
			if (product != null) {
				found.put(key, product);
			}
		}
		return Map.copyOf(found);
	}

	@Override
	public Optional<Image> findActiveImage(Key product) {
		requireAvailable();
		Path path = imagePaths.get(product);
		if (path == null || !products.containsKey(product)) {
			return Optional.empty();
		}
		String filename = path.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
		String contentType;
		if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
			contentType = "image/jpeg";
		}
		else if (filename.endsWith(".png")) {
			contentType = "image/png";
		}
		else if (filename.endsWith(".webp")) {
			contentType = "image/webp";
		}
		else {
			return Optional.empty();
		}
		try {
			return Optional.of(new Image(Files.readAllBytes(path), contentType));
		}
		catch (IOException exception) {
			return Optional.empty();
		}
	}

	private record FixtureRecord(
			@JsonProperty("product_id") String productId,
			@JsonProperty("product_version_id") String productVersionId,
			String title,
			String category,
			@JsonProperty("image_path") String imagePath) {
	}
}
