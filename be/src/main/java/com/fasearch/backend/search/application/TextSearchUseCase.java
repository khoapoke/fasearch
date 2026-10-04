package com.fasearch.backend.search.application;

import java.util.List;

public interface TextSearchUseCase {

	Result search(Command command);

	record Command(String queryText, int k, String traceId) {
	}

	record Result(
			String schemaVersion,
			String traceId,
			String mode,
			Publication publication,
			int requestedK,
			int returnedK,
			Provenance provenance,
			List<Product> results,
			Latency latency) {
	}

	record Publication(String catalogSnapshotId, String modelVersion, String indexVersion) {
	}

	record Provenance(
			String artifactScope,
			String modelConfigHash,
			String textNormalizationVersion,
			String textOverflowPolicy) {
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
