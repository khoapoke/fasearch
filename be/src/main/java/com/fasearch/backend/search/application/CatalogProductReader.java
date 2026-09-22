package com.fasearch.backend.search.application;

import java.util.Collection;
import java.util.Map;

public interface CatalogProductReader {

	Map<Key, Product> findActive(Collection<Key> products);

	record Key(String productId, String productVersionId) {
	}

	record Product(
			String productId,
			String productVersionId,
			String title,
			String category,
			String imageUrl) {
		public Key key() {
			return new Key(productId, productVersionId);
		}
	}
}
