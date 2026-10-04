package com.fasearch.backend.search.application;

import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;

import tools.jackson.databind.json.JsonMapper;

/**
 * Lazy holder for the pinned immutable public catalog snapshot. The
 * application still starts when the publication is missing or incompatible;
 * browse requests then fail closed with {@code CATALOG_UNAVAILABLE} instead
 * of serving a silent fixture or default overlay.
 */
public final class PublicCatalogSnapshotProvider {

	private final FaSearchProperties properties;
	private final JsonMapper jsonMapper;
	private final AtomicReference<PublicCatalogSnapshot> cached = new AtomicReference<>();
	private final AtomicReference<Boolean> failed = new AtomicReference<>(false);

	public PublicCatalogSnapshotProvider(FaSearchProperties properties, JsonMapper jsonMapper) {
		this.properties = properties;
		this.jsonMapper = jsonMapper;
	}

	public PublicCatalogSnapshot snapshot() {
		PublicCatalogSnapshot loaded = cached.get();
		if (loaded != null) {
			return loaded;
		}
		if (Boolean.TRUE.equals(failed.get())) {
			throw unavailable();
		}
		synchronized (cached) {
			loaded = cached.get();
			if (loaded != null) {
				return loaded;
			}
			if (Boolean.TRUE.equals(failed.get())) {
				throw unavailable();
			}
			String file = properties.catalog().file();
			try {
				if (file == null || file.isBlank()) {
					throw new IllegalStateException("Public catalog file is not configured");
				}
				loaded = new PublicCatalogSnapshot(
						properties.publication().catalogSnapshotId(),
						Path.of(file),
						jsonMapper);
			}
			catch (IllegalStateException exception) {
				failed.set(true);
				throw unavailable();
			}
			cached.set(loaded);
			return loaded;
		}
	}

	private static SearchException unavailable() {
		return new SearchException(
				"CATALOG_UNAVAILABLE",
				HttpStatus.SERVICE_UNAVAILABLE,
				"Catalog publication is not available");
	}
}
