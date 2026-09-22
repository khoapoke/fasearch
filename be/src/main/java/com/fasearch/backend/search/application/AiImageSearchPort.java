package com.fasearch.backend.search.application;

import java.util.List;

public interface AiImageSearchPort {

	Response search(Request request);

	record Request(
			byte[] image,
			String contentType,
			String filename,
			int k,
			String traceId,
			Publication publication) {
	}

	record Response(Publication publication, List<Hit> results, double aiLatencyMs) {
	}

	record Publication(String catalogSnapshotId, String modelVersion, String indexVersion) {
	}

	record Hit(String productId, String productVersionId, int rank, double similarityScore) {
	}
}
