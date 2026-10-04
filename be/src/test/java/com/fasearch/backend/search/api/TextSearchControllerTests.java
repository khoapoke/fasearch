package com.fasearch.backend.search.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.function.Function;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasearch.backend.search.application.TextSearchUseCase;

@WebMvcTest(value = TextSearchController.class,
		properties = "spring.security.user.password=unused-test-password")
@AutoConfigureMockMvc(addFilters = false)
@Import({ SearchApiExceptionHandler.class, TextSearchControllerTests.TestConfig.class })
class TextSearchControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private FakeTextSearchUseCase textSearch;

	@BeforeEach
	void resetFake() {
		textSearch.behavior = command -> {
			throw new AssertionError("Test must configure the text search fake");
		};
	}

	@Test
	void returnsRankedCardsAndTraceHeaders() throws Exception {
		textSearch.behavior = command -> result(command.traceId(), command.k());

		mockMvc.perform(post("/api/v1/search/text")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"schema_version\":\"1.0.0\",\"query_text\":\"váy đỏ\",\"k\":3}")
				.header("X-Trace-Id", "trace-1"))
				.andExpect(status().isOk())
				.andExpect(header().string("X-Trace-Id", "trace-1"))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(jsonPath("$.mode").value("TEXT"))
				.andExpect(jsonPath("$.requested_k").value(3));
	}

	@Test
	void rejectsLoneSurrogateWithTypedErrorAndHeaders() throws Exception {
		mockMvc.perform(post("/api/v1/search/text")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"schema_version\":\"1.0.0\",\"query_text\":\"\\ud800\",\"k\":3}"
						.getBytes(StandardCharsets.UTF_8))
				.header("X-Trace-Id", "trace-surr"))
				.andExpect(status().isBadRequest())
				.andExpect(header().string("X-Trace-Id", "trace-surr"))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void rejectsNullAndOverflowingK() throws Exception {
		mockMvc.perform(post("/api/v1/search/text")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"schema_version\":\"1.0.0\",\"query_text\":\"váy\",\"k\":null}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(post("/api/v1/search/text")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"schema_version\":\"1.0.0\",\"query_text\":\"váy\",\"k\":999999999999}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(post("/api/v1/search/text")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"schema_version\":\"1.0.0\",\"query_text\":\"váy\",\"k\":2.5}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void rejectsMalformedUtf8AndOversizeBody() throws Exception {
		byte[] malformed = ("{\"schema_version\":\"1.0.0\",\"query_text\":\""
				+ "váy" + "\",\"k\":3}").getBytes(StandardCharsets.UTF_8);
		malformed[30] = (byte) 0xFF;
		mockMvc.perform(post("/api/v1/search/text")
				.contentType(MediaType.APPLICATION_JSON)
				.content(malformed))
				.andExpect(status().isBadRequest())
				.andExpect(header().string("Cache-Control", "no-store"));

		String big = "{\"schema_version\":\"1.0.0\",\"query_text\":\"" + "y".repeat(17000) + "\",\"k\":3}";
		mockMvc.perform(post("/api/v1/search/text")
				.contentType(MediaType.APPLICATION_JSON)
				.content(big.getBytes(StandardCharsets.UTF_8))
				.header("X-Trace-Id", "trace-big"))
				.andExpect(status().isPayloadTooLarge())
				.andExpect(header().string("X-Trace-Id", "trace-big"))
				.andExpect(header().string("Cache-Control", "no-store"));
	}

	private static TextSearchUseCase.Result result(String traceId, int k) {
		return new TextSearchUseCase.Result(
				"1.0.0", traceId, "TEXT",
				new TextSearchUseCase.Publication("catalog-v1", "model-v1", "index-v1"),
				k, 1,
				new TextSearchUseCase.Provenance(
						"PILOT_ONLY", "hash", "nfc-whitespace-v1", "RAW_CAP_ONLY"),
				List.of(new TextSearchUseCase.Product("p1", "p1-v1", 1, 0.9, "Áo", "TOP", "/p1")),
				new TextSearchUseCase.Latency(1.0, 2.0));
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TestConfig {
		@Bean
		FakeTextSearchUseCase textSearchUseCase() {
			return new FakeTextSearchUseCase();
		}
	}

	static final class FakeTextSearchUseCase implements TextSearchUseCase {
		private Function<Command, Result> behavior;

		@Override
		public Result search(Command command) {
			return behavior.apply(command);
		}
	}
}
