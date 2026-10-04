package com.fasearch.backend.search.application;

import java.util.List;

public interface AiTextSearchPort {

	Response search(Request request);

	record Request(
			String queryText,
			int k,
			String traceId,
			Publication publication) {
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
			String textOverflowPolicy) {
	}

	record Hit(String productId, String productVersionId, int rank, double similarityScore) {
	}
}
