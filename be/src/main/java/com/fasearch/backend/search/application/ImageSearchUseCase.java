package com.fasearch.backend.search.application;

import java.util.List;

public interface ImageSearchUseCase {

	Result search(Command command);

	record Command(byte[] image, String contentType, String filename, int k, String traceId) {
	}

	record Result(
			String schemaVersion,
			String traceId,
			String mode,
			Publication publication,
			List<Product> results,
			Latency latency) {
	}

	record Publication(String catalogSnapshotId, String modelVersion, String indexVersion) {
	}

	record Product(
			String productId,
			String productVersionId,
			int rank,
			double similarityScore,
			String title,
			String category,
			String imageUrl) {
	}

	record Latency(double aiLatencyMs, double totalLatencyMs) {
	}
}
