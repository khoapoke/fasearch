package com.fasearch.backend.search.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fasearch.backend.config.FaSearchProperties;
import com.fasearch.backend.search.application.AiImageSearchPort.Hit;
import com.fasearch.backend.search.application.CatalogProductReader.Key;

class ImageSearchModuleTests {

	private static final AiImageSearchPort.Publication PUBLICATION =
			new AiImageSearchPort.Publication("catalog-v1", "model-v1", "index-v1");

	@Test
	void joinsActiveCatalogMetadataWithoutChangingAiRank() {
		AiImageSearchPort ai = request -> new AiImageSearchPort.Response(
				PUBLICATION,
				List.of(
						new Hit("p2", "p2-v1", 1, 0.91),
						new Hit("p1", "p1-v1", 2, 0.84)),
				2.5);
		CatalogProductReader catalog = requested -> Map.of(
				new Key("p1", "p1-v1"),
				new CatalogProductReader.Product("p1", "p1-v1", "Áo đỏ", "TOP", "/p1.png"),
				new Key("p2", "p2-v1"),
				new CatalogProductReader.Product("p2", "p2-v1", "Váy xanh", "ONE_PIECE", "/p2.png"));
		ImageSearchModule module = module(ai, catalog);

		ImageSearchUseCase.Result result = module.search(command());

		assertThat(result.traceId()).isEqualTo("trace-1");
		assertThat(result.results()).extracting(ImageSearchUseCase.Product::productId)
				.containsExactly("p2", "p1");
		assertThat(result.results()).extracting(ImageSearchUseCase.Product::rank)
				.containsExactly(1, 2);
		assertThat(result.results().get(0).title()).isEqualTo("Váy xanh");
		assertThat(result.latency().aiLatencyMs()).isEqualTo(2.5);
	}

	@Test
	void failsClosedWhenAiReturnsAProductOutsideTheActiveCatalog() {
		AiImageSearchPort ai = request -> new AiImageSearchPort.Response(
				PUBLICATION,
				List.of(new Hit("missing", "missing-v1", 1, 0.95)),
				1.0);
		ImageSearchModule module = module(ai, requested -> Map.of());

		assertThatThrownBy(() -> module.search(command()))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("CATALOG_VERSION_MISMATCH");
	}

	@Test
	void rejectsUnsupportedImageTypesBeforeCallingAi() {
		AiImageSearchPort ai = request -> {
			throw new AssertionError("AI port must not be called");
		};
		ImageSearchModule module = module(ai, requested -> Map.of());

		ImageSearchUseCase.Command command = new ImageSearchUseCase.Command(
				new byte[] { 1, 2, 3 },
				"image/gif",
				"query.gif",
				10,
				"trace-1");
		assertThatThrownBy(() -> module.search(command))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("INVALID_IMAGE");
	}

	@Test
	void rejectsTopKOutsideThePublicContractBeforeCallingAi() {
		AiImageSearchPort ai = request -> {
			throw new AssertionError("AI port must not be called");
		};
		ImageSearchModule module = module(ai, requested -> Map.of());
		ImageSearchUseCase.Command command = new ImageSearchUseCase.Command(
				new byte[] { 1, 2, 3 },
				"image/png",
				"query.png",
				101,
				"trace-1");

		assertThatThrownBy(() -> module.search(command))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("INVALID_REQUEST");
	}

	private static ImageSearchModule module(
			AiImageSearchPort ai,
			CatalogProductReader catalog) {
		return new ImageSearchModule(
				ai,
				catalog,
				new FaSearchProperties.Publication(
						PUBLICATION.catalogSnapshotId(),
						PUBLICATION.modelVersion(),
						PUBLICATION.indexVersion()));
	}

	private static ImageSearchUseCase.Command command() {
		return new ImageSearchUseCase.Command(
				new byte[] { 1, 2, 3 },
				"image/png",
				"query.png",
				2,
				"trace-1");
	}
}
