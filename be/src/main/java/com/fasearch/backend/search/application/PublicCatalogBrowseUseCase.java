package com.fasearch.backend.search.application;

import java.util.List;

public interface PublicCatalogBrowseUseCase {

	PageResult list(ListQuery query);

	DetailResult detail(DetailQuery query);

	record ListQuery(int page, int size, String category, String expectedSnapshotId, String traceId) {
	}

	record DetailQuery(
			String productId,
			String expectedProductVersionId,
			String expectedSnapshotId,
			String traceId) {
	}

	record PageResult(
			String schemaVersion,
			String traceId,
			Publication publication,
			String artifactScope,
			int page,
			int size,
			int total,
			boolean hasMore,
			List<Item> items) {
	}

	record DetailResult(
			String schemaVersion,
			String traceId,
			Publication publication,
			String artifactScope,
			String productId,
			String productVersionId,
			String title,
			String category,
			String description,
			String imageUrl) {
	}

	record Publication(String catalogSnapshotId, String modelVersion, String indexVersion) {
	}

	record Item(
			String productId,
			String productVersionId,
			String title,
			String category,
			String imageUrl) {
	}
}
