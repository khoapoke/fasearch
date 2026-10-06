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

import com.fasearch.backend.search.application.ImageSearchUseCase;
import com.fasearch.backend.search.application.SearchException;

@WebMvcTest(value = ImageSearchController.class,
		properties = "spring.security.user.password=unused-test-password")
@AutoConfigureMockMvc(addFilters = false)
@Import({ SearchApiExceptionHandler.class, ImageSearchControllerTests.TestConfig.class })
class ImageSearchControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private FakeImageSearchUseCase imageSearch;

	@BeforeEach
	void resetFake() {
		imageSearch.behavior = command -> {
			throw new AssertionError("Test must configure the image search fake");
		};
	}

	@Test
	void returnsPublicProductMetadataAndTraceId() throws Exception {
		imageSearch.behavior = command -> new ImageSearchUseCase.Result(
				"1.0.0",
				"trace-1",
				"IMAGE",
				new ImageSearchUseCase.Publication("catalog-v1", "model-v1", "index-v1"),
				List.of(new ImageSearchUseCase.Product(
						"p1", "p1-v1", 1, 0.91, "Áo đỏ", "TOP", "/p1.png")),
				new ImageSearchUseCase.Latency(2.5, 4.0));
		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });

		mockMvc.perform(multipart("/api/v1/search/image")
				.file(image)
				.param("k", "1")
				.header("X-Trace-Id", "trace-1"))
				.andExpect(status().isOk())
				.andExpect(header().string("X-Trace-Id", "trace-1"))
				.andExpect(jsonPath("$.schema_version").value("1.0.0"))
				.andExpect(jsonPath("$.publication.index_version").value("index-v1"))
				.andExpect(jsonPath("$.results[0].product_id").value("p1"))
				.andExpect(jsonPath("$.results[0].title").value("Áo đỏ"));
	}

	@Test
	void mapsModuleFailuresToAStableErrorContract() throws Exception {
		imageSearch.behavior = command -> {
			throw new SearchException(
				"AI_UNAVAILABLE",
				HttpStatus.SERVICE_UNAVAILABLE,
				"AI service is unavailable");
		};
		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });

		mockMvc.perform(multipart("/api/v1/search/image")
				.file(image)
				.header("X-Trace-Id", "trace-error"))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.trace_id").value("trace-error"))
				.andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));
	}

	@Test
	void rejectsTopKOutsideThePublicContract() throws Exception {
		imageSearch.behavior = command -> {
			throw new SearchException(
					"INVALID_REQUEST",
					HttpStatus.BAD_REQUEST,
					"K must be between 1 and 100");
		};
		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });

		mockMvc.perform(multipart("/api/v1/search/image")
				.file(image)
				.param("k", "101")
				.header("X-Trace-Id", "trace-invalid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void returnsStableErrorsForMalformedMultipartRequests() throws Exception {
		mockMvc.perform(multipart("/api/v1/search/image")
				.header("X-Trace-Id", "trace-missing"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.trace_id").value("trace-missing"))
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		MockMultipartFile image = new MockMultipartFile(
				"image", "query.png", "image/png", new byte[] { 1, 2, 3 });
		mockMvc.perform(multipart("/api/v1/search/image")
				.file(image)
				.param("k", "not-a-number")
				.header("X-Trace-Id", "trace-type"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.trace_id").value("trace-type"))
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
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
		FakeImageSearchUseCase imageSearchUseCase() {
			return new FakeImageSearchUseCase();
		}
	}

	static final class FakeImageSearchUseCase implements ImageSearchUseCase {
		private Function<Command, Result> behavior;

		@Override
		public Result search(Command command) {
			return behavior.apply(command);
		}
	}
}
