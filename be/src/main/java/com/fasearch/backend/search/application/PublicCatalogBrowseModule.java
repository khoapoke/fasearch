package com.fasearch.backend.search.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;

/**
 * Browse over one pinned immutable {@link PublicCatalogSnapshot}. Count and
 * items always come from the same snapshot; filtering preserves frozen file
 * order. No latest-version fallback and no fixture/default overlay.
 */
public final class PublicCatalogBrowseModule implements PublicCatalogBrowseUseCase {

	static final int MAX_PAGE = Integer.MAX_VALUE;

	private static final Set<String> ALLOWED_CATEGORIES = Set.of("TOP", "BOTTOM", "ONE_PIECE");

	private final PublicCatalogSnapshotProvider snapshots;
	private final FaSearchProperties.Publication publication;

	public PublicCatalogBrowseModule(
			PublicCatalogSnapshotProvider snapshots,
			FaSearchProperties.Publication publication) {
		this.snapshots = snapshots;
		this.publication = publication;
	}

	@Override
	public PageResult list(ListQuery query) {
		validateList(query);
		PublicCatalogSnapshot snapshot = snapshots.snapshot();
		if (query.expectedSnapshotId() != null
				&& !snapshot.catalogSnapshotId().equals(query.expectedSnapshotId())) {
			throw new SearchException(
					"CATALOG_SNAPSHOT_MISMATCH",
					HttpStatus.CONFLICT,
					"Catalog snapshot does not match the active publication");
		}
		List<PublicCatalogSnapshot.Entry> filtered = new ArrayList<>();
		for (PublicCatalogSnapshot.Entry entry : snapshot.entries()) {
			if (query.category() == null || query.category().equals(entry.category())) {
				filtered.add(entry);
			}
		}
		int total = filtered.size();
		long offset = (long) (query.page() - 1) * (long) query.size();
		List<Item> items = new ArrayList<>();
		boolean hasMore;
		if (offset >= total) {
			hasMore = false;
		}
		else {
			int from = (int) offset;
			int to = Math.min(from + query.size(), total);
			for (PublicCatalogSnapshot.Entry entry : filtered.subList(from, to)) {
				items.add(toItem(entry));
			}
			hasMore = (offset + query.size()) < total;
		}
		return new PageResult(
				"1.0.0",
				query.traceId(),
				viewPublication(),
				"PILOT_ONLY",
				query.page(),
				query.size(),
				total,
				hasMore,
				List.copyOf(items));
	}

	@Override
	public DetailResult detail(DetailQuery query) {
		validateDetail(query);
		PublicCatalogSnapshot snapshot = snapshots.snapshot();
		boolean hasVersion = query.expectedProductVersionId() != null;
		boolean hasSnapshot = query.expectedSnapshotId() != null;
		if (hasVersion != hasSnapshot) {
			throw new SearchException(
					"INVALID_REQUEST",
					HttpStatus.BAD_REQUEST,
					"Expected product context requires both version and snapshot");
		}
		if (hasSnapshot && !snapshot.catalogSnapshotId().equals(query.expectedSnapshotId())) {
			throw new SearchException(
					"CATALOG_SNAPSHOT_MISMATCH",
					HttpStatus.CONFLICT,
					"Catalog snapshot does not match the active publication");
		}
		PublicCatalogSnapshot.Entry entry = snapshot.findByProductId(query.productId());
		if (entry == null) {
			throw notFound();
		}
		if (hasVersion && !entry.productVersionId().equals(query.expectedProductVersionId())) {
			throw notFound();
		}
		return new DetailResult(
				"1.0.0",
				query.traceId(),
				viewPublication(),
				"PILOT_ONLY",
				entry.productId(),
				entry.productVersionId(),
				entry.title(),
				entry.category(),
				null,
				entry.imageUrl());
	}

	private Publication viewPublication() {
		return new Publication(
				publication.catalogSnapshotId(),
				publication.modelVersion(),
				publication.indexVersion());
	}

	private static Item toItem(PublicCatalogSnapshot.Entry entry) {
		return new Item(
				entry.productId(),
				entry.productVersionId(),
				entry.title(),
				entry.category(),
				entry.imageUrl());
	}

	private static SearchException notFound() {
		return new SearchException(
				"CATALOG_PRODUCT_NOT_FOUND",
				HttpStatus.NOT_FOUND,
				"Product is not available in the active publication");
	}

	private static void validateList(ListQuery query) {
		if (query == null
				|| query.page() < 1
				|| query.size() < 1
				|| query.size() > 60
				|| query.traceId() == null
				|| query.traceId().isBlank()) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Invalid browse request");
		}
		if (query.category() != null && !ALLOWED_CATEGORIES.contains(query.category())) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Invalid category");
		}
	}

	private static void validateDetail(DetailQuery query) {
		if (query == null
				|| query.productId() == null
				|| query.productId().isBlank()
				|| query.traceId() == null
				|| query.traceId().isBlank()) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Invalid detail request");
		}
	}
}
