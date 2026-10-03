package com.fasearch.backend.search.application;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.CatalogProductReader.Key;
import com.fasearch.backend.search.application.ComposedSearchUseCase.Reference;

public final class ComposedSearchModule implements ComposedSearchUseCase {

	static final String EFFECTIVE_FUSION_VERSION = "equal-weight-l2-v1";
	static final int MAX_TEXT_CODE_POINTS = 1024;
	static final int MAX_ID_CODE_POINTS = 128;
	static final int MAX_SNAPSHOT_CODE_POINTS = 256;

	private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
			"image/jpeg",
			"image/png",
			"image/webp");
	private static final int MAX_IMAGE_BYTES = 10 * 1024 * 1024;

	private final AiComposedSearchPort aiSearch;
	private final CatalogProductReader catalog;
	private final CatalogImageReader images;
	private final FaSearchProperties.Publication publication;

	public ComposedSearchModule(
			AiComposedSearchPort aiSearch,
			CatalogProductReader catalog,
			CatalogImageReader images,
			FaSearchProperties.Publication publication) {
		this.aiSearch = aiSearch;
		this.catalog = catalog;
		this.images = images;
		this.publication = publication;
	}

	@Override
	public Result search(Command command) {
		validate(command);
		long started = System.nanoTime();
		AiComposedSearchPort.Publication expected = new AiComposedSearchPort.Publication(
				publication.catalogSnapshotId(),
				publication.modelVersion(),
				publication.indexVersion());

		ResolvedReference resolved = resolve(command.reference());
		AiComposedSearchPort.Response aiResponse = aiSearch.search(new AiComposedSearchPort.Request(
				resolved.image(),
				resolved.contentType(),
				resolved.filename(),
				command.modificationText(),
				command.k(),
				command.traceId(),
				expected,
				EFFECTIVE_FUSION_VERSION,
				resolved.excludeProductId()));
		validateAiResponse(aiResponse, command, resolved.excludeProductId());

		LinkedHashSet<Key> keys = aiResponse.results().stream()
				.map(hit -> new Key(hit.productId(), hit.productVersionId()))
				.collect(Collectors.toCollection(LinkedHashSet::new));
		Map<Key, CatalogProductReader.Product> products = catalog.findActive(keys);
		List<Product> results = new ArrayList<>();
		for (AiComposedSearchPort.Hit hit : aiResponse.results()) {
			results.add(join(hit, products));
		}

		double totalLatencyMs = (System.nanoTime() - started) / 1_000_000.0;
		AiComposedSearchPort.Provenance provenance = aiResponse.provenance();
		return new Result(
				"1.0.0",
				command.traceId(),
				"COMPOSED",
				new Publication(
						aiResponse.publication().catalogSnapshotId(),
						aiResponse.publication().modelVersion(),
						aiResponse.publication().indexVersion()),
				command.k(),
				results.size(),
				view(command.reference()),
				new Provenance(
						provenance.artifactScope(),
						provenance.modelConfigHash(),
						provenance.textNormalizationVersion(),
						provenance.textOverflowPolicy(),
						provenance.selfMatchPolicy(),
						new Fusion(
								provenance.fusion().fusionVersion(),
								provenance.fusion().strategy(),
								provenance.fusion().imageWeight(),
								provenance.fusion().textWeight(),
								provenance.fusion().componentNormalization(),
								provenance.fusion().outputNormalization(),
								provenance.fusion().similarityMetric())),
				results,
				new Latency(aiResponse.aiLatencyMs(), totalLatencyMs));
	}

	private record ResolvedReference(
			byte[] image, String contentType, String filename, String excludeProductId) {
	}

	private ResolvedReference resolve(Reference reference) {
		if (reference instanceof Reference.Upload upload) {
			if (upload.image() == null || upload.image().length == 0) {
				throw new SearchException("INVALID_IMAGE", HttpStatus.BAD_REQUEST, "Image is empty");
			}
			if (upload.image().length > MAX_IMAGE_BYTES) {
				throw new SearchException(
						"IMAGE_TOO_LARGE",
						HttpStatus.CONTENT_TOO_LARGE,
						"Image exceeds the 10 MiB limit");
			}
			if (!ALLOWED_CONTENT_TYPES.contains(upload.contentType())) {
				throw new SearchException(
						"INVALID_IMAGE",
						HttpStatus.UNSUPPORTED_MEDIA_TYPE,
						"Unsupported image content type");
			}
			return new ResolvedReference(upload.image(), upload.contentType(), upload.filename(), null);
		}
		Reference.Product product = (Reference.Product) reference;
		if (!product.anchorCatalogSnapshotId().equals(publication.catalogSnapshotId())) {
			throw new SearchException(
					"ANCHOR_PUBLICATION_MISMATCH",
					HttpStatus.CONFLICT,
					"Anchor snapshot does not match the active publication");
		}
		Key key = new Key(product.anchorProductId(), product.anchorProductVersionId());
		if (!catalog.findActive(Set.of(key)).containsKey(key)) {
			throw new SearchException(
					"ANCHOR_NOT_AVAILABLE",
					HttpStatus.NOT_FOUND,
					"Anchor product is not available in the active publication");
		}
		Optional<CatalogImageReader.Image> image = images.findActiveImage(key);
		if (image.isEmpty()) {
			throw new SearchException(
					"CATALOG_UNAVAILABLE",
					HttpStatus.SERVICE_UNAVAILABLE,
					"Anchor image cannot be read from the active publication");
		}
		return new ResolvedReference(
				image.get().content(), image.get().contentType(), key.productId(), key.productId());
	}

	private static ReferenceView view(Reference reference) {
		if (reference instanceof Reference.Product product) {
			return ReferenceView.product(
					product.anchorProductId(),
					product.anchorProductVersionId(),
					product.anchorCatalogSnapshotId());
		}
		return ReferenceView.upload();
	}

	private void validateAiResponse(
			AiComposedSearchPort.Response response,
			Command command,
			String excludeProductId) {
		if (response == null
				|| !"1.0.0".equals(response.schemaVersion())
				|| !"COMPOSED".equals(response.mode())
				|| !command.traceId().equals(response.traceId())
				|| response.publication() == null
				|| response.results() == null
				|| response.provenance() == null
				|| response.provenance().fusion() == null) {
			throw contractMismatch();
		}
		AiComposedSearchPort.Publication expected = new AiComposedSearchPort.Publication(
				publication.catalogSnapshotId(),
				publication.modelVersion(),
				publication.indexVersion());
		if (!expected.equals(response.publication())) {
			throw new SearchException(
					"AI_PUBLICATION_MISMATCH",
					HttpStatus.SERVICE_UNAVAILABLE,
					"AI response publication does not match the active publication");
		}
		if (!EFFECTIVE_FUSION_VERSION.equals(response.provenance().fusion().fusionVersion())
				|| !"PILOT_ONLY".equals(response.provenance().artifactScope())
				|| response.provenance().modelConfigHash() == null
				|| response.provenance().modelConfigHash().isBlank()
				|| !(excludeProductId != null
						? "EXCLUDE_ANCHOR_PRODUCT".equals(response.provenance().selfMatchPolicy())
						: "NONE".equals(response.provenance().selfMatchPolicy()))) {
			throw contractMismatch();
		}
		if (response.requestedK() != command.k()
				|| response.returnedK() != response.results().size()
				|| response.results().size() > command.k()) {
			throw contractMismatch();
		}
		for (int i = 0; i < response.results().size(); i++) {
			AiComposedSearchPort.Hit hit = response.results().get(i);
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
				"AI response failed composed contract validation");
	}

	private Product join(AiComposedSearchPort.Hit hit, Map<Key, CatalogProductReader.Product> products) {
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
		if (command == null || command.reference() == null) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Missing search reference");
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
		if (command.modificationText() == null) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Missing modification text");
		}
		if (command.modificationText().codePointCount(0, command.modificationText().length())
				> MAX_TEXT_CODE_POINTS) {
			throw new SearchException(
					"TEXT_TOO_LONG",
					HttpStatus.BAD_REQUEST,
					"Modification text exceeds 1024 characters");
		}
		if (modelView(command.modificationText()).isEmpty()) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Modification text is empty");
		}
		if (command.reference() instanceof Reference.Product product) {
			validateId(product.anchorProductId(), MAX_ID_CODE_POINTS, "anchor_product_id");
			validateId(product.anchorProductVersionId(), MAX_ID_CODE_POINTS, "anchor_product_version_id");
			validateId(product.anchorCatalogSnapshotId(), MAX_SNAPSHOT_CODE_POINTS, "anchor_catalog_snapshot_id");
		}
	}


	private static void validateId(String value, int maxCodePoints, String field) {
		if (value == null
				|| value.isBlank()
				|| value.codePointCount(0, value.length()) > maxCodePoints) {
			throw new SearchException(
					"INVALID_REQUEST", HttpStatus.BAD_REQUEST, "Invalid " + field);
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
