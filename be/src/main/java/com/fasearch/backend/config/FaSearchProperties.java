package com.fasearch.backend.config;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fasearch")
public record FaSearchProperties(Ai ai, Publication publication, Catalog catalog) {

	public record Ai(URI baseUrl, Duration connectTimeout, Duration readTimeout) {
	}

	public record Publication(String catalogSnapshotId, String modelVersion, String indexVersion) {
	}

	public record Catalog(String file, List<Product> products) {
		public Catalog {
			products = products == null ? List.of() : List.copyOf(products);
		}
	}

	public record Product(
			String productId,
			String productVersionId,
			String title,
			String category,
			String imageUrl) {
	}
}
