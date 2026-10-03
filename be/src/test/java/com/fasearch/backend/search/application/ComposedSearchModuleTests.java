package com.fasearch.backend.search.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.ComposedSearchUseCase.Reference;

class ComposedSearchModuleTests {

	private static final AiComposedSearchPort.Publication PUBLICATION =
			new AiComposedSearchPort.Publication("catalog-v1", "model-v1", "index-v1");

	@Test
	void joinsActiveMetadataPreservingAiRankAndOrder() {
		ComposedSearchModule module = module(
				request -> aiResponse(request.traceId(), "NONE", null, 3),
				requested -> Map.of(
						new CatalogProductReader.Key("p1", "p1-v1"),
						new CatalogProductReader.Product(
								"p1", "p1-v1", "Áo sơ mi linen", "TOP", "/p1.png"),
						new CatalogProductReader.Key("p2", "p2-v1"),
						new CatalogProductReader.Product(
								"p2", "p2-v1", "Quần short", "BOTTOM", "/p2.png")),
				Optional.empty());

		ComposedSearchUseCase.Result result = module.search(uploadCommand());

		assertThat(result.mode()).isEqualTo("COMPOSED");
		assertThat(result.requestedK()).isEqualTo(3);
		assertThat(result.returnedK()).isEqualTo(2);
		assertThat(result.reference().type()).isEqualTo("UPLOAD");
		assertThat(result.results()).extracting(ComposedSearchUseCase.Product::productId)
				.containsExactly("p1", "p2");
		assertThat(result.provenance().selfMatchPolicy()).isEqualTo("NONE");
		assertThat(result.provenance().fusion().fusionVersion()).isEqualTo("equal-weight-l2-v1");
	}

	@Test
	void productReferenceResolvesBytesAndDerivesExclusion() {
		CatalogProductReader.Key anchor = new CatalogProductReader.Key("p1", "p1-v1");
		byte[] anchorBytes = new byte[] { 9, 9, 9 };
		List<AiComposedSearchPort.Request> received = new java.util.ArrayList<>();
		AiComposedSearchPort ai = request -> {
			received.add(request);
			return aiResponse(request.traceId(), "EXCLUDE_ANCHOR_PRODUCT", "p1", 5);
		};
		ComposedSearchModule module = new ComposedSearchModule(
				ai,
				requested -> Map.of(
						anchor,
						new CatalogProductReader.Product(
								"p1", "p1-v1", "Áo sơ mi linen", "TOP", "/p1.png"),
						new CatalogProductReader.Key("p2", "p2-v1"),
						new CatalogProductReader.Product(
								"p2", "p2-v1", "Quần short", "BOTTOM", "/p2.png")),
				product -> product.equals(anchor)
						? Optional.of(new CatalogImageReader.Image(anchorBytes, "image/png"))
						: Optional.empty(),
				publication());

		ComposedSearchUseCase.Result result = module.search(new ComposedSearchUseCase.Command(
				new Reference.Product("p1", "p1-v1", "catalog-v1"),
				"tay dài hơn",
				5,
				"trace-product"));

		assertThat(received).hasSize(1);
		assertThat(received.get(0).image()).isEqualTo(anchorBytes);
		assertThat(received.get(0).excludeProductId()).isEqualTo("p1");
		assertThat(result.reference().type()).isEqualTo("PRODUCT");
		assertThat(result.reference().productId()).isEqualTo("p1");
		assertThat(result.provenance().selfMatchPolicy()).isEqualTo("EXCLUDE_ANCHOR_PRODUCT");
	}

	@Test
	void rejectsStaleAnchorSnapshotMissingAnchorAndUnreadableImage() {
		ComposedSearchModule stale = module(
				request -> aiResponse(request.traceId(), "NONE", null, 3),
				requested -> Map.of(),
				Optional.empty());
		assertThatThrownBy(() -> stale.search(new ComposedSearchUseCase.Command(
				new Reference.Product("p1", "p1-v1", "catalog-old"),
				"x",
				5,
				"trace-stale")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("ANCHOR_PUBLICATION_MISMATCH");

		ComposedSearchModule missing = module(
				request -> {
					throw new AssertionError("AI port must not be called");
				},
				requested -> Map.of(),
				Optional.empty());
		assertThatThrownBy(() -> missing.search(new ComposedSearchUseCase.Command(
				new Reference.Product("ghost", "ghost-v1", "catalog-v1"),
				"x",
				5,
				"trace-missing")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("ANCHOR_NOT_AVAILABLE");

		CatalogProductReader.Key anchor = new CatalogProductReader.Key("p1", "p1-v1");
		ComposedSearchModule unreadable = new ComposedSearchModule(
				request -> {
					throw new AssertionError("AI port must not be called");
				},
				requested -> Map.of(
						anchor,
						new CatalogProductReader.Product("p1", "p1-v1", "Áo", "TOP", "/p1.png")),
				product -> Optional.empty(),
				publication());
		assertThatThrownBy(() -> unreadable.search(new ComposedSearchUseCase.Command(
				new Reference.Product("p1", "p1-v1", "catalog-v1"),
				"x",
				5,
				"trace-unreadable")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("CATALOG_UNAVAILABLE");
	}

	@Test
	void rejectsTextBoundariesBeforeCallingAi() {
		ComposedSearchModule module = module(
				request -> {
					throw new AssertionError("AI port must not be called");
				},
				requested -> Map.of(),
				Optional.empty());

		assertThatThrownBy(() -> module.search(commandWithText(null)))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("INVALID_REQUEST");
		assertThatThrownBy(() -> module.search(commandWithText("   ")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("INVALID_REQUEST");
		assertThatThrownBy(() -> module.search(commandWithText("\u00a0\u2007")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("INVALID_REQUEST");
		ComposedSearchModule accepting = module(
				request -> aiResponse(request.traceId(), "NONE", null, 3),
				requested -> Map.of(
						new CatalogProductReader.Key("p1", "p1-v1"),
						new CatalogProductReader.Product("p1", "p1-v1", "\u00c1o", "TOP", "/p1.png"),
						new CatalogProductReader.Key("p2", "p2-v1"),
						new CatalogProductReader.Product("p2", "p2-v1", "Qu\u1ea7n", "BOTTOM", "/p2.png")),
				Optional.empty());
		assertThat(accepting.search(commandWithText("a\u0301o len")).returnedK()).isEqualTo(2);
		assertThatThrownBy(() -> module.search(commandWithText("x".repeat(1025))))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("TEXT_TOO_LONG");
	}

	@Test
	void acceptsExactly1024CodePointsAndCountsAstralAsOne() {
		ComposedSearchModule module = module(
				request -> aiResponse(request.traceId(), "NONE", null, 3),
				requested -> Map.of(
						new CatalogProductReader.Key("p1", "p1-v1"),
						new CatalogProductReader.Product("p1", "p1-v1", "\u00c1o", "TOP", "/p1.png"),
						new CatalogProductReader.Key("p2", "p2-v1"),
						new CatalogProductReader.Product("p2", "p2-v1", "Qu\u1ea7n", "BOTTOM", "/p2.png")),
				Optional.empty());

		ComposedSearchUseCase.Result result = module.search(commandWithText("y".repeat(1023) + "\uD83D\uDE00"));
		assertThat(result.returnedK()).isEqualTo(2);
	}

	@Test
	void failsClosedOnAiContractViolations() {
		AiComposedSearchPort.Response mismatchedFusion = new AiComposedSearchPort.Response(
				"1.0.0",
				"trace-1",
				"COMPOSED",
				PUBLICATION,
				3,
				1,
				new AiComposedSearchPort.Provenance(
						"PILOT_ONLY",
						"cfg",
						"nfc-whitespace-v1",
						"RAW_CAP_ONLY",
						"NONE",
						new AiComposedSearchPort.Fusion(
								"other-fusion-v9",
								"WEIGHTED_SUM",
								0.5,
								0.5,
								"L2",
								"L2",
								"NORMALIZED_INNER_PRODUCT")),
				List.of(new AiComposedSearchPort.Hit("p1", "p1-v1", 1, 0.9)),
				1.0);
		ComposedSearchModule module = new ComposedSearchModule(
				request -> mismatchedFusion,
				requested -> Map.of(
						new CatalogProductReader.Key("p1", "p1-v1"),
						new CatalogProductReader.Product("p1", "p1-v1", "Áo", "TOP", "/p1.png")),
				product -> Optional.empty(),
				publication());

		assertThatThrownBy(() -> module.search(uploadCommand()))
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("AI_CONTRACT_MISMATCH");
	}

	@Test
	void javaModelViewMatchesCoreWhitespaceSemantics() {
		assertThat(ComposedSearchModule.modelView("  a\u0301o \u00a0 \u0111o\u0309  ")).isEqualTo("\u00e1o \u0111\u1ecf");
		assertThat(ComposedSearchModule.modelView("\u00a0")).isEmpty();
		assertThat(ComposedSearchModule.modelView("v\u00e1y\u00a0linen")).isEqualTo("v\u00e1y linen");
	}

	private static ComposedSearchModule module(
			AiComposedSearchPort ai,
			CatalogProductReader catalog,
			Optional<CatalogImageReader.Image> image) {
		return new ComposedSearchModule(ai, catalog, product -> image, publication());
	}

	private static FaSearchProperties.Publication publication() {
		return new FaSearchProperties.Publication(
				PUBLICATION.catalogSnapshotId(),
				PUBLICATION.modelVersion(),
				PUBLICATION.indexVersion());
	}

	private static AiComposedSearchPort.Response aiResponse(
			String traceId, String selfMatch, String excluded, int requestedK) {
		return new AiComposedSearchPort.Response(
				"1.0.0",
				traceId,
				"COMPOSED",
				PUBLICATION,
				requestedK,
				2,
				new AiComposedSearchPort.Provenance(
						"PILOT_ONLY",
						"cfghash",
						"nfc-whitespace-v1",
						"RAW_CAP_ONLY",
						selfMatch,
						new AiComposedSearchPort.Fusion(
								"equal-weight-l2-v1",
								"WEIGHTED_SUM",
								0.5,
								0.5,
								"L2",
								"L2",
								"NORMALIZED_INNER_PRODUCT")),
				excluded == null
						? List.of(
								new AiComposedSearchPort.Hit("p1", "p1-v1", 1, 0.91),
								new AiComposedSearchPort.Hit("p2", "p2-v1", 2, 0.84))
						: List.of(
								new AiComposedSearchPort.Hit("p2", "p2-v1", 1, 0.88),
								new AiComposedSearchPort.Hit("p1", "p1-v1", 2, 0.84)),
				2.5);
	}

	private static ComposedSearchUseCase.Command uploadCommand() {
		return new ComposedSearchUseCase.Command(
				new Reference.Upload(new byte[] { 1, 2, 3 }, "image/png", "query.png"),
				"đổi sang màu navy",
				3,
				"trace-1");
	}

	private static ComposedSearchUseCase.Command commandWithText(String text) {
		ComposedSearchUseCase.Command base = uploadCommand();
		return new ComposedSearchUseCase.Command(base.reference(), text, base.k(), base.traceId());
	}
}
