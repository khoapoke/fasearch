package com.fasearch.backend.search.application;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonProperty;

import tools.jackson.databind.json.JsonMapper;

/**
 * Immutable ordered reader over the exact configured pilot catalog JSONL.
 * Membership comes only from real file rows (never Draft DB, never the
 * {@code fasearch.catalog.products} overlay). Row order is the frozen file
 * order and is preserved for deterministic pagination.
 */
public final class PublicCatalogSnapshot {

	private static final Set<String> ALLOWED_CATEGORIES = Set.of("TOP", "BOTTOM", "ONE_PIECE");

	private final String catalogSnapshotId;
	private final List<Entry> entries;
	private final Map<String, Entry> byProductId;

	public PublicCatalogSnapshot(String catalogSnapshotId, Path file, JsonMapper jsonMapper) {
		if (catalogSnapshotId == null || catalogSnapshotId.isBlank()) {
			throw new IllegalStateException("Pinned catalog snapshot id is missing");
		}
		if (file == null) {
			throw new IllegalStateException("Catalog file is not configured");
		}
		this.catalogSnapshotId = catalogSnapshotId;
		List<Entry> loaded = load(file, jsonMapper, catalogSnapshotId);
		this.entries = List.copyOf(loaded);
		Map<String, Entry> index = new LinkedHashMap<>();
		for (Entry entry : loaded) {
			index.put(entry.productId(), entry);
		}
		this.byProductId = Map.copyOf(index);
	}

	public String catalogSnapshotId() {
		return catalogSnapshotId;
	}

	public int size() {
		return entries.size();
	}

	public List<Entry> entries() {
		return entries;
	}

	public Entry findByProductId(String productId) {
		return byProductId.get(productId);
	}

	private static List<Entry> load(Path file, JsonMapper jsonMapper, String expectedSnapshot) {
		List<String> lines;
		try {
			lines = Files.readAllLines(file);
		}
		catch (IOException exception) {
			throw new IllegalStateException("Could not read catalog file", exception);
		}
		List<Entry> loaded = new ArrayList<>();
		Set<String> seenProducts = new java.util.HashSet<>();
		Set<String> seenVersions = new java.util.HashSet<>();
		int row = 0;
		for (String line : lines) {
			row++;
			if (line.isBlank()) {
				continue;
			}
			final CatalogRow item;
			try {
				item = jsonMapper.readValue(line, CatalogRow.class);
			}
			catch (RuntimeException exception) {
				throw new IllegalStateException("Invalid catalog row " + row, exception);
			}
			if (item == null || item.productId() == null || item.productId().isBlank()
					|| item.productVersionId() == null || item.productVersionId().isBlank()
					|| item.title() == null || item.title().isBlank()
					|| item.category() == null || !ALLOWED_CATEGORIES.contains(item.category())) {
				throw new IllegalStateException("Invalid catalog row " + row);
			}
			if (!expectedSnapshot.equals(item.catalogSnapshotId())) {
				throw new IllegalStateException("Catalog row snapshot mismatch at row " + row);
			}
			if (!seenProducts.add(item.productId()) || !seenVersions.add(item.productVersionId())) {
				throw new IllegalStateException("Duplicate catalog identity at row " + row);
			}
			loaded.add(new Entry(
					item.productId(),
					item.productVersionId(),
					item.title(),
					item.category(),
					"/api/catalog/images/" + item.productId() + "/" + item.productVersionId()));
		}
		if (loaded.isEmpty()) {
			throw new IllegalStateException("Catalog file has no rows");
		}
		return loaded;
	}

	public record Entry(
			String productId,
			String productVersionId,
			String title,
			String category,
			String imageUrl) {
	}

	private record CatalogRow(
			@JsonProperty("product_id") String productId,
			@JsonProperty("product_version_id") String productVersionId,
			String title,
			String category,
			@JsonProperty("catalog_snapshot_id") String catalogSnapshotId) {
	}
}
