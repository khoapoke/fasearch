package com.fasearch.backend.search.application;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.AiImageSearchPort.Hit;
import com.fasearch.backend.search.application.CatalogProductReader.Key;

public final class ImageSearchModule implements ImageSearchUseCase {

	private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
			"image/jpeg",
			"image/png",
			"image/webp");
	private static final int MAX_IMAGE_BYTES = 10 * 1024 * 1024;

	private final AiImageSearchPort aiSearch;
	private final CatalogProductReader catalog;
	private final FaSearchProperties.Publication publication;

	public ImageSearchModule(
			AiImageSearchPort aiSearch,
			CatalogProductReader catalog,
			FaSearchProperties.Publication publication) {
		this.aiSearch = aiSearch;
		this.catalog = catalog;
		this.publication = publication;
	}

	@Override
	public Result search(Command command) {
		validate(command);
		long started = System.nanoTime();
		AiImageSearchPort.Publication expected = new AiImageSearchPort.Publication(
				publication.catalogSnapshotId(),
				publication.modelVersion(),
				publication.indexVersion());
		AiImageSearchPort.Response aiResponse = aiSearch.search(new AiImageSearchPort.Request(
				command.image(),
				command.contentType(),
				command.filename(),
				command.k(),
				command.traceId(),
				expected));

		if (!expected.equals(aiResponse.publication())) {
			throw new SearchException(
					"AI_PUBLICATION_MISMATCH",
					HttpStatus.SERVICE_UNAVAILABLE,
					"AI response publication does not match the active publication");
		}

		LinkedHashSet<Key> keys = aiResponse.results().stream()
				.map(hit -> new Key(hit.productId(), hit.productVersionId()))
				.collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
		Map<Key, CatalogProductReader.Product> products = catalog.findActive(keys);
		List<Product> results = aiResponse.results().stream()
				.map(hit -> join(hit, products))
				.toList();

		double totalLatencyMs = (System.nanoTime() - started) / 1_000_000.0;
		return new Result(
				"1.0.0",
				command.traceId(),
				"IMAGE",
				new Publication(
						aiResponse.publication().catalogSnapshotId(),
						aiResponse.publication().modelVersion(),
						aiResponse.publication().indexVersion()),
				results,
				new Latency(aiResponse.aiLatencyMs(), totalLatencyMs));
	}

	private Product join(Hit hit, Map<Key, CatalogProductReader.Product> products) {
		Key key = new Key(hit.productId(), hit.productVersionId());
		CatalogProductReader.Product product = products.get(key);
		if (product == null) {
			throw new SearchException(
					"CATALOG_VERSION_MISMATCH",
					HttpStatus.SERVICE_UNAVAILABLE,
					"AI result is missing from the active catalog publication");
		}
		return new Product(
				hit.productId(),
				hit.productVersionId(),
				hit.rank(),
				hit.similarityScore(),
				product.title(),
				product.category(),
				product.imageUrl());
	}

	private static void validate(Command command) {
		if (command.k() < 1 || command.k() > 100) {
			throw new SearchException(
					"INVALID_REQUEST",
					HttpStatus.BAD_REQUEST,
					"K must be between 1 and 100");
		}
		if (command.image() == null || command.image().length == 0) {
			throw new SearchException("INVALID_IMAGE", HttpStatus.BAD_REQUEST, "Image is empty");
		}
		if (command.image().length > MAX_IMAGE_BYTES) {
			throw new SearchException(
					"IMAGE_TOO_LARGE",
					HttpStatus.CONTENT_TOO_LARGE,
					"Image exceeds the 10 MiB limit");
		}
		if (!ALLOWED_CONTENT_TYPES.contains(command.contentType())) {
			throw new SearchException(
					"INVALID_IMAGE",
					HttpStatus.UNSUPPORTED_MEDIA_TYPE,
					"Unsupported image content type");
		}
	}
}
