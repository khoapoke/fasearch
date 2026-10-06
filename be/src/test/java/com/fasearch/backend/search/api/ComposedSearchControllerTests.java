package com.fasearch.backend.search.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.function.Function;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import com.fasearch.backend.search.application.ComposedSearchUseCase;
import com.fasearch.backend.search.application.SearchException;

@WebMvcTest(value = ComposedSearchController.class,
		properties = "spring.security.user.password=unused-test-password")
@AutoConfigureMockMvc(addFilters = false)
@Import({ SearchApiExceptionHandler.class, ComposedSearchControllerTests.TestConfig.class })
class ComposedSearchControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private FakeComposedSearchUseCase composedSearch;

	@BeforeEach
	void resetFake() {
		composedSearch.behavior = command -> {
			throw new AssertionError("Test must configure the composed search fake");
		};
	}

	@Test
	void returnsRankedCardsAndTraceForUploadReference() throws Exception {
		composedSearch.behavior = command -> uploadResult();
		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });

		mockMvc.perform(multipart("/api/v1/search/composed")
				.file(image)
				.param("schema_version", "1.0.0")
				.param("modification_text", "đổi sang màu navy")
				.param("k", "3")
				.header("X-Trace-Id", "trace-1"))
				.andExpect(status().isOk())
				.andExpect(header().string("X-Trace-Id", "trace-1"))
				.andExpect(jsonPath("$.schema_version").value("1.0.0"))
				.andExpect(jsonPath("$.mode").value("COMPOSED"))
				.andExpect(jsonPath("$.reference.type").value("UPLOAD"))
				.andExpect(jsonPath("$.requested_k").value(3))
				.andExpect(jsonPath("$.results[0].product_id").value("p1"));
	}

	@Test
	void acceptsExactProductReferenceWithoutImage() throws Exception {
		composedSearch.behavior = command -> productResult();

		mockMvc.perform(multipart("/api/v1/search/composed")
				.param("schema_version", "1.0.0")
				.param("modification_text", "tay dài hơn")
				.param("anchor_product_id", "p1")
				.param("anchor_product_version_id", "p1-v1")
				.param("anchor_catalog_snapshot_id", "catalog-v1")
				.header("X-Trace-Id", "trace-product"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reference.type").value("PRODUCT"))
				.andExpect(jsonPath("$.reference.product_id").value("p1"));
	}

	@Test
	void rejectsCombinedImageAndAnchorReference() throws Exception {
		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });

		mockMvc.perform(multipart("/api/v1/search/composed")
				.file(image)
				.param("schema_version", "1.0.0")
				.param("modification_text", "x")
				.param("anchor_product_id", "p1")
				.param("anchor_product_version_id", "p1-v1")
				.param("anchor_catalog_snapshot_id", "catalog-v1")
				.header("X-Trace-Id", "trace-both"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void rejectsUnknownDuplicateAndMalformedParts() throws Exception {
		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });

		mockMvc.perform(multipart("/api/v1/search/composed")
				.file(image)
				.param("schema_version", "1.0.0")
				.param("modification_text", "x")
				.param("client_alpha", "0.9")
				.header("X-Trace-Id", "trace-unknown"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(multipart("/api/v1/search/composed")
				.file(image)
				.param("schema_version", "1.0.0")
				.param("modification_text", "x")
				.param("k", "not-a-number")
				.header("X-Trace-Id", "trace-k"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(multipart("/api/v1/search/composed")
				.param("schema_version", "1.0.0")
				.param("modification_text", "x")
				.header("X-Trace-Id", "trace-missing"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.trace_id").value("trace-missing"))
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void mapsModuleFailuresToStableErrors() throws Exception {
		composedSearch.behavior = command -> {
			throw new SearchException(
					"ANCHOR_NOT_AVAILABLE",
					HttpStatus.NOT_FOUND,
					"Anchor product is not available in the active publication");
		};
		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });

		mockMvc.perform(multipart("/api/v1/search/composed")
				.file(image)
				.param("schema_version", "1.0.0")
				.param("modification_text", "x")
				.header("X-Trace-Id", "trace-anchor"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ANCHOR_NOT_AVAILABLE"));
	}

	private static ComposedSearchUseCase.Result uploadResult() {
		return new ComposedSearchUseCase.Result(
				"1.0.0",
				"trace-1",
				"COMPOSED",
				new ComposedSearchUseCase.Publication("catalog-v1", "model-v1", "index-v1"),
				3,
				1,
				ComposedSearchUseCase.ReferenceView.upload(),
				provenance("NONE"),
				List.of(new ComposedSearchUseCase.Product(
						"p1", "p1-v1", 1, 0.91, "Áo sơ mi", "TOP", "/p1.png")),
				new ComposedSearchUseCase.Latency(3.0, 5.0));
	}

	private static ComposedSearchUseCase.Result productResult() {
		return new ComposedSearchUseCase.Result(
				"1.0.0",
				"trace-product",
				"COMPOSED",
				new ComposedSearchUseCase.Publication("catalog-v1", "model-v1", "index-v1"),
				10,
				1,
				ComposedSearchUseCase.ReferenceView.product("p1", "p1-v1", "catalog-v1"),
				provenance("EXCLUDE_ANCHOR_PRODUCT"),
				List.of(new ComposedSearchUseCase.Product(
						"p2", "p2-v1", 1, 0.88, "Váy linen", "ONE_PIECE", "/p2.png")),
				new ComposedSearchUseCase.Latency(3.0, 5.0));
	}

	private static ComposedSearchUseCase.Provenance provenance(String selfMatch) {
		return new ComposedSearchUseCase.Provenance(
				"PILOT_ONLY",
				"cfghash",
				"nfc-whitespace-v1",
				"RAW_CAP_ONLY",
				selfMatch,
				new ComposedSearchUseCase.Fusion(
						"equal-weight-l2-v1",
						"WEIGHTED_SUM",
						0.5,
						0.5,
						"L2",
						"L2",
						"NORMALIZED_INNER_PRODUCT"));
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TestConfig {
		@Bean
		com.fasearch.backend.library.LibraryModule libraryModule() {
			return new com.fasearch.backend.library.LibraryModule(null, null, null, null) {
				@Override
				public com.fasearch.backend.library.LibraryModule.HistoryStatus recordAfterSuccess(
						org.springframework.security.core.Authentication actor,
						String mode,
						String queryTextOrNull,
						String catalogSnapshotId,
						String modelVersion,
						String indexVersion,
						java.util.List<com.fasearch.backend.library.LibraryModule.ProductRef> refs,
						int resultCount,
						String traceId) {
					return com.fasearch.backend.library.LibraryModule.HistoryStatus.NOT_RECORDED;
				}
			};
		}
		@Bean
		FakeComposedSearchUseCase composedSearchUseCase() {
			return new FakeComposedSearchUseCase();
		}
	}

	static final class FakeComposedSearchUseCase implements ComposedSearchUseCase {
		private Function<Command, Result> behavior;

		@Override
		public Result search(Command command) {
			return behavior.apply(command);
		}
	}
}
