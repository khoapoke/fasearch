package com.fasearch.backend.search.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.test.web.servlet.MockMvc;

import com.fasearch.backend.search.application.PublicCatalogBrowseUseCase;

@WebMvcTest(value = PublicCatalogController.class,
		properties = "spring.security.user.password=unused-test-password")
@AutoConfigureMockMvc(addFilters = false)
@Import({ SearchApiExceptionHandler.class, PublicCatalogControllerTests.TestConfig.class })
class PublicCatalogControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private FakeBrowseUseCase browse;

	@BeforeEach
	void resetFake() {
		browse.listBehavior = query -> {
			throw new AssertionError("Test must configure the list fake");
		};
		browse.detailBehavior = query -> {
			throw new AssertionError("Test must configure the detail fake");
		};
	}

	@Test
	void listReturnsPageWithTraceAndNoStore() throws Exception {
		browse.listBehavior = query -> new PublicCatalogBrowseUseCase.PageResult(
				"1.0.0",
				"trace-list",
				new PublicCatalogBrowseUseCase.Publication("catalog-v1", "model-v1", "index-v1"),
				"PILOT_ONLY",
				2, 2, 5, true,
				List.of(new PublicCatalogBrowseUseCase.Item(
						"p3", "p3-v1", "Váy hoa", "ONE_PIECE", "/api/catalog/images/p3/p3-v1")));

		mockMvc.perform(get("/api/v1/catalog/products")
				.queryParam("page", "2")
				.queryParam("size", "2")
				.header("X-Trace-Id", "trace-list"))
				.andExpect(status().isOk())
				.andExpect(header().string("X-Trace-Id", "trace-list"))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(jsonPath("$.schema_version").value("1.0.0"))
				.andExpect(jsonPath("$.total").value(5))
				.andExpect(jsonPath("$.has_more").value(true))
				.andExpect(jsonPath("$.items[0].product_id").value("p3"));
	}

	@Test
	void listRejectsUnknownDuplicateAndOverflowQueries() throws Exception {
		mockMvc.perform(get("/api/v1/catalog/products").queryParam("sort", "price"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(get("/api/v1/catalog/products?size=10&size=20"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(get("/api/v1/catalog/products").queryParam("page", "99999999999999999999"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(get("/api/v1/catalog/products").queryParam("size", "61"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/catalog/products").queryParam("category", "SHOES"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/catalog/products").queryParam("page", ""))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/catalog/products?page"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void detailReturnsExactVersionWithTrace() throws Exception {
		browse.detailBehavior = query -> new PublicCatalogBrowseUseCase.DetailResult(
				"1.0.0",
				"trace-detail",
				new PublicCatalogBrowseUseCase.Publication("catalog-v1", "model-v1", "index-v1"),
				"PILOT_ONLY",
				"p1", "p1-v1", "Áo đỏ", "TOP", null, "/api/catalog/images/p1/p1-v1");

		mockMvc.perform(get("/api/v1/catalog/products/p1")
				.header("X-Trace-Id", "trace-detail"))
				.andExpect(status().isOk())
				.andExpect(header().string("X-Trace-Id", "trace-detail"))
				.andExpect(jsonPath("$.product_version_id").value("p1-v1"))
				.andExpect(jsonPath("$.description").isEmpty());
	}

	@Test
	void detailRejectsPartialExpectedContext() throws Exception {
		mockMvc.perform(get("/api/v1/catalog/products/p1")
				.queryParam("product_version_id", "p1-v1"))
				.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void rejectedTraceIsNeverReflected() throws Exception {
		String unsafe = "A".repeat(200);
		org.springframework.test.web.servlet.MvcResult result = mockMvc.perform(get("/api/v1/catalog/products")
				.queryParam("size", "1")
				.header("X-Trace-Id", unsafe))
				.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
			.andReturn();
		String headerTrace = result.getResponse().getHeader("X-Trace-Id");
		String bodyTrace = com.jayway.jsonpath.JsonPath.read(
				result.getResponse().getContentAsString(), "$.trace_id");
		org.assertj.core.api.Assertions.assertThat(headerTrace)
				.doesNotContain(unsafe)
				.matches("[0-9a-f-]{36}");
		org.assertj.core.api.Assertions.assertThat(bodyTrace)
				.isEqualTo(headerTrace);
	}

	@TestConfiguration
	static class TestConfig {
		@Bean
		FakeBrowseUseCase browseUseCase() {
			return new FakeBrowseUseCase();
		}
	}

	static class FakeBrowseUseCase implements PublicCatalogBrowseUseCase {
		volatile Function<ListQuery, PageResult> listBehavior;
		volatile Function<DetailQuery, DetailResult> detailBehavior;

		@Override
		public PageResult list(ListQuery query) {
			return listBehavior.apply(query);
		}

		@Override
		public DetailResult detail(DetailQuery query) {
			return detailBehavior.apply(query);
		}
	}
}
