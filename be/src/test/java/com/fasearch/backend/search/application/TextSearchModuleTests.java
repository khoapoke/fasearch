package com.fasearch.backend.search.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;

class TextSearchModuleTests {

	private static final AiTextSearchPort.Publication PUBLICATION =
			new AiTextSearchPort.Publication("catalog-v1", "model-v1", "index-v1");

	@Test
	void joinsActiveMetadataPreservingAiRankAndOrder() {
		TextSearchModule module = new TextSearchModule(
				request -> aiResponse(request.traceId(), 3),
				requested -> Map.of(
						new CatalogProductReader.Key("p1", "p1-v1"),
						new CatalogProductReader.Product(
								"p1", "p1-v1", "Áo đỏ", "TOP", "/p1.png"),
						new CatalogProductReader.Key("p2", "p2-v1"),
						new CatalogProductReader.Product(
								"p2", "p2-v1", "Váy xanh", "ONE_PIECE", "/p2.png")),
				publication());

		TextSearchUseCase.Result result = module.search(
				new TextSearchUseCase.Command("váy đỏ", 3, "trace-1"));

		assertThat(result.mode()).isEqualTo("TEXT");
		assertThat(result.requestedK()).isEqualTo(3);
		assertThat(result.returnedK()).isEqualTo(2);
		assertThat(result.results()).extracting(TextSearchUseCase.Product::productId)
				.containsExactly("p1", "p2");
		assertThat(result.provenance().artifactScope()).isEqualTo("PILOT_ONLY");
	}

	@Test
	void rejectsBlankQueryAndOverlongText() {
		TextSearchModule module = new TextSearchModule(
				request -> aiResponse(request.traceId(), 10),
				requested -> Map.of(),
				publication());
		assertThatThrownBy(() -> module.search(new TextSearchUseCase.Command("   ", 10, "t")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("INVALID_REQUEST");
		assertThatThrownBy(() -> module.search(
				new TextSearchUseCase.Command("x".repeat(1025), 10, "t")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("TEXT_TOO_LONG");
	}

	@Test
	void failClosedOnContractMismatch() {
		TextSearchModule module = new TextSearchModule(
				request -> new AiTextSearchPort.Response(
						"9.9.9", request.traceId(), "TEXT",
						PUBLICATION, request.k(), 1,
						new AiTextSearchPort.Provenance(
								"PILOT_ONLY", "hash", "nfc-whitespace-v1", "RAW_CAP_ONLY"),
						List.of(new AiTextSearchPort.Hit("p1", "p1-v1", 1, 0.5)), 1.0),
				requested -> Map.of(
						new CatalogProductReader.Key("p1", "p1-v1"),
						new CatalogProductReader.Product("p1", "p1-v1", "Áo", "TOP", "/p1.png")),
				publication());
		assertThatThrownBy(() -> module.search(new TextSearchUseCase.Command("áo", 10, "t")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("AI_CONTRACT_MISMATCH");
	}

	private static AiTextSearchPort.Response aiResponse(String traceId, int requestedK) {
		return new AiTextSearchPort.Response(
				"1.0.0", traceId, "TEXT", PUBLICATION, requestedK, 2,
				new AiTextSearchPort.Provenance(
						"PILOT_ONLY", "hash-fixture", "nfc-whitespace-v1", "RAW_CAP_ONLY"),
				List.of(
						new AiTextSearchPort.Hit("p1", "p1-v1", 1, 0.91),
						new AiTextSearchPort.Hit("p2", "p2-v1", 2, 0.85)),
				2.5);
	}

	private static FaSearchProperties.Publication publication() {
		return new FaSearchProperties.Publication("catalog-v1", "model-v1", "index-v1");
	}
}
