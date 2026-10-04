package com.fasearch.backend.search.application;

import java.util.List;

public interface AiComposedSearchPort {

	Response search(Request request);

	record Request(
			byte[] image,
			String contentType,
			String filename,
			String modificationText,
			int k,
			String traceId,
			Publication publication,
			String fusionVersion,
			String excludeProductId) {
	}

	record Response(
			String schemaVersion,
			String traceId,
			String mode,
			Publication publication,
			int requestedK,
			int returnedK,
			Provenance provenance,
			List<Hit> results,
			double aiLatencyMs) {
	}

	record Publication(String catalogSnapshotId, String modelVersion, String indexVersion) {
	}

	record Provenance(
			String artifactScope,
			String modelConfigHash,
			String textNormalizationVersion,
			String textOverflowPolicy,
			String selfMatchPolicy,
			Fusion fusion) {
	}

	record Fusion(
			String fusionVersion,
			String strategy,
			double imageWeight,
			double textWeight,
			String componentNormalization,
			String outputNormalization,
			String similarityMetric) {
	}

	record Hit(String productId, String productVersionId, int rank, double similarityScore) {
	}
}
