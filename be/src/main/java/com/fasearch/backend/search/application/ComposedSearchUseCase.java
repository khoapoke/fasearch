package com.fasearch.backend.search.application;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

public interface ComposedSearchUseCase {

	Result search(Command command);

	record Command(
			Reference reference,
			String modificationText,
			int k,
			String traceId) {
	}

	sealed interface Reference permits Reference.Upload, Reference.Product {

		record Upload(byte[] image, String contentType, String filename) implements Reference {
		}

		record Product(
				String anchorProductId,
				String anchorProductVersionId,
				String anchorCatalogSnapshotId) implements Reference {
		}
	}

	record Result(
			String schemaVersion,
			String traceId,
			String mode,
			Publication publication,
			int requestedK,
			int returnedK,
			ReferenceView reference,
			Provenance provenance,
			List<Product> results,
			Latency latency) {
	}

	record Publication(String catalogSnapshotId, String modelVersion, String indexVersion) {
	}

	@JsonInclude(JsonInclude.Include.NON_NULL)
	record ReferenceView(
			String type,
			String productId,
			String productVersionId,
			String catalogSnapshotId) {

		public static ReferenceView upload() {
			return new ReferenceView("UPLOAD", null, null, null);
		}

		public static ReferenceView product(String productId, String productVersionId, String snapshotId) {
			return new ReferenceView("PRODUCT", productId, productVersionId, snapshotId);
		}
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
