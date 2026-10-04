package com.fasearch.backend.search.application;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.CatalogProductReader.Key;

public final class TextSearchModule implements TextSearchUseCase {

	static final int MAX_TEXT_CODE_POINTS = 1024;

	private final AiTextSearchPort aiSearch;
	private final CatalogProductReader catalog;
	private final FaSearchProperties.Publication publication;

	public TextSearchModule(
			AiTextSearchPort aiSearch,
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
		AiTextSearchPort.Publication expected = new AiTextSearchPort.Publication(
				publication.catalogSnapshotId(),
				publication.modelVersion(),
				publication.indexVersion());
		AiTextSearchPort.Response aiResponse = aiSearch.search(new AiTextSearchPort.Request(
				command.queryText(),
				command.k(),
				command.traceId(),
				expected));
		validateAiResponse(aiResponse, command);

		LinkedHashSet<Key> keys = aiResponse.results().stream()
				.map(hit -> new Key(hit.productId(), hit.productVersionId()))
				.collect(Collectors.toCollection(LinkedHashSet::new));
		Map<Key, CatalogProductReader.Product> products = catalog.findActive(keys);
		List<Product> results = aiResponse.results().stream()
				.map(hit -> join(hit, products))
				.toList();

		double totalLatencyMs = (System.nanoTime() - started) / 1_000_000.0;
		AiTextSearchPort.Provenance provenance = aiResponse.provenance();
		return new Result(
				"1.0.0",
				command.traceId(),
				"TEXT",
				new Publication(
						aiResponse.publication().catalogSnapshotId(),
						aiResponse.publication().modelVersion(),
						aiResponse.publication().indexVersion()),
				command.k(),
				results.size(),
				new Provenance(
						provenance.artifactScope(),
						provenance.modelConfigHash(),
						provenance.textNormalizationVersion(),
						provenance.textOverflowPolicy()),
				results,
				new Latency(aiResponse.aiLatencyMs(), totalLatencyMs));
	}

	private void validateAiResponse(AiTextSearchPort.Response response, Command command) {
		if (response == null
				|| !"1.0.0".equals(response.schemaVersion())
				|| !"TEXT".equals(response.mode())
				|| !command.traceId().equals(response.traceId())
				|| response.publication() == null
				|| response.results() == null
				|| response.provenance() == null) {
			throw contractMismatch();
		}
		AiTextSearchPort.Publication expected = new AiTextSearchPort.Publication(
				publication.catalogSnapshotId(),
				publication.modelVersion(),
				publication.indexVersion());
		if (!expected.equals(response.publication())) {
			throw new SearchException(
					"AI_PUBLICATION_MISMATCH",
					HttpStatus.SERVICE_UNAVAILABLE,
					"AI response publication does not match the active publication");
		}
		if (!"PILOT_ONLY".equals(response.provenance().artifactScope())
				|| !"nfc-whitespace-v1".equals(response.provenance().textNormalizationVersion())
				|| response.provenance().modelConfigHash() == null
				|| response.provenance().modelConfigHash().isBlank()
				|| (!"RAW_CAP_ONLY".equals(response.provenance().textOverflowPolicy())
						&& !"REJECT_MODEL_LIMIT".equals(response.provenance().textOverflowPolicy()))) {
			throw contractMismatch();
		}
		if (response.requestedK() != command.k()
				|| response.returnedK() != response.results().size()
				|| response.results().size() > command.k()) {
			throw contractMismatch();
		}
		for (int i = 0; i < response.results().size(); i++) {
			AiTextSearchPort.Hit hit = response.results().get(i);
			if (hit == null
					|| hit.rank() != i + 1
					|| hit.productId() == null
					|| hit.productVersionId() == null
					|| !Double.isFinite(hit.similarityScore())) {
				throw contractMismatch();
			}
		}
		if (!Double.isFinite(response.aiLatencyMs()) || response.aiLatencyMs() < 0) {
			throw contractMismatch();
		}
	}

	private static SearchException contractMismatch() {
		return new SearchException(
				"AI_CONTRACT_MISMATCH",
				HttpStatus.SERVICE_UNAVAILABLE,
				"AI response failed text contract validation");
	}

	private Product join(AiTextSearchPort.Hit hit, Map<Key, CatalogProductReader.Product> products) {
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
		if (command == null || command.queryText() == null) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Missing query text");
		}
		if (command.k() < 1 || command.k() > 100) {
			throw new SearchException(
					"INVALID_REQUEST",
					HttpStatus.BAD_REQUEST,
					"K must be between 1 and 100");
		}
		if (command.traceId() == null || command.traceId().isBlank()) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Missing trace identity");
		}
		if (command.queryText().codePointCount(0, command.queryText().length()) > MAX_TEXT_CODE_POINTS) {
			throw new SearchException(
					"TEXT_TOO_LONG",
					HttpStatus.BAD_REQUEST,
					"Query text exceeds 1024 characters");
		}
		if (modelView(command.queryText()).isEmpty()) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Query text is empty");
		}
	}

	/** NFC plus Unicode-whitespace collapse, mirroring the core model view. */
	static String modelView(String raw) {
		String normalized = Normalizer.normalize(raw, Normalizer.Form.NFC);
		String collapsed = normalized.replaceAll("(?U)\\s+", " ");
		int start = 0;
		int end = collapsed.length();
		while (start < end && collapsed.charAt(start) == ' ') {
			start++;
		}
		while (end > start && collapsed.charAt(end - 1) == ' ') {
			end--;
		}
		return collapsed.substring(start, end);
	}
}
