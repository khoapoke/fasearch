package com.fasearch.backend.search.infrastructure.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.search.application.AiComposedSearchPort;
import com.fasearch.backend.search.application.SearchException;

class HttpAiComposedSearchAdapterTests {

	private MockRestServiceServer server;
	private HttpAiComposedSearchAdapter adapter;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.local");
		server = MockRestServiceServer.bindTo(builder).build();
		adapter = new HttpAiComposedSearchAdapter(builder.build(), new JsonMapper());
	}

	@Test
	void sendsResolvedBytesWithPerPartMimeAndMapsProvenance() {
		server.expect(once(), requestTo("http://ai.local/internal/v1/search/composed"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("X-Trace-Id", "trace-1"))
				.andExpect(content().string(Matchers.allOf(
						Matchers.containsString("Content-Type: image/png"),
						Matchers.containsString("modification_text"),
						Matchers.containsString("fusion_version"),
						Matchers.containsString("equal-weight-l2-v1"))))
				.andRespond(withSuccess("""
						{
						  "schema_version": "1.0.0",
						  "trace_id": "trace-1",
						  "mode": "COMPOSED",
						  "publication": {
						    "catalog_snapshot_id": "catalog-v1",
						    "model_version": "model-v1",
						    "index_version": "index-v1"
						  },
						  "requested_k": 4,
						  "returned_k": 2,
						  "provenance": {
						    "artifact_scope": "PILOT_ONLY",
						    "model_config_hash": "cfghash",
						    "text_normalization_version": "nfc-whitespace-v1",
						    "text_overflow_policy": "REJECT_MODEL_LIMIT",
						    "self_match_policy": "EXCLUDE_ANCHOR_PRODUCT",
						    "fusion": {
						      "fusion_version": "equal-weight-l2-v1",
						      "strategy": "WEIGHTED_SUM",
						      "image_weight": 0.5,
						      "text_weight": 0.5,
						      "component_normalization": "L2",
						      "output_normalization": "L2",
						      "similarity_metric": "NORMALIZED_INNER_PRODUCT"
						    }
						  },
						  "results": [
						    {"product_id": "p2", "product_version_id": "p2-v1", "rank": 1, "similarity_score": 0.88},
						    {"product_id": "p3", "product_version_id": "p3-v1", "rank": 2, "similarity_score": 0.81}
						  ],
						  "ai_latency_ms": 3.5
						}
						""", MediaType.APPLICATION_JSON));

		AiComposedSearchPort.Response response = adapter.search(request("p2"));

		server.verify();
		assertThat(response.requestedK()).isEqualTo(4);
		assertThat(response.returnedK()).isEqualTo(2);
		assertThat(response.provenance().textOverflowPolicy()).isEqualTo("REJECT_MODEL_LIMIT");
		assertThat(response.provenance().selfMatchPolicy()).isEqualTo("EXCLUDE_ANCHOR_PRODUCT");
		assertThat(response.results()).extracting(AiComposedSearchPort.Hit::productId)
				.containsExactly("p2", "p3");
	}

	@Test
	void omitsExclusionPartWhenNoAnchorProduct() {
		server.expect(once(), requestTo("http://ai.local/internal/v1/search/composed"))
				.andExpect(content().string(Matchers.not(Matchers.containsString("exclude_product_id"))))
				.andRespond(withSuccess(successBody(), MediaType.APPLICATION_JSON));

		AiComposedSearchPort.Response response = adapter.search(request(null));

		server.verify();
		assertThat(response.provenance().selfMatchPolicy()).isEqualTo("NONE");
	}

	@Test
	void mapsTypedBadRequestsToMatchingPublicCodes() {
		assertMappedError(400, "TEXT_TOO_LONG", "TEXT_TOO_LONG", HttpStatus.BAD_REQUEST);
	}

	@Test
	void mapsImageBadRequestAndUnknownCodes() {
		assertMappedError(400, "INVALID_IMAGE", "INVALID_IMAGE", HttpStatus.BAD_REQUEST);
	}

	@Test
	void mapsUnknownBadRequestCodeToContractMismatch() {
		assertMappedError(400, "SOME_FUTURE_CODE", "AI_CONTRACT_MISMATCH",
				HttpStatus.SERVICE_UNAVAILABLE);
	}

	@Test
	void mapsTypedConflictsToMatchingUnavailableCodes() {
		assertMappedError(409, "FUSION_VERSION_MISMATCH", "AI_FUSION_MISMATCH",
				HttpStatus.SERVICE_UNAVAILABLE);
	}

	@Test
	void mapsPublicationConflictToUnavailable() {
		assertMappedError(409, "PUBLICATION_MISMATCH", "AI_PUBLICATION_MISMATCH",
				HttpStatus.SERVICE_UNAVAILABLE);
	}

	@Test
	void mapsUnprocessableEntityToBadRequest() {
		assertMappedError(422, "INVALID_REQUEST", "INVALID_REQUEST", HttpStatus.BAD_REQUEST);
	}

	private void assertMappedError(
			int aiStatus, String aiCode, String expectedCode, HttpStatus expectedStatus) {
		server.expect(once(), requestTo("http://ai.local/internal/v1/search/composed"))
				.andRespond(withStatus(HttpStatus.valueOf(aiStatus))
						.contentType(MediaType.APPLICATION_JSON)
						.body("{\"code\":\"" + aiCode + "\",\"message\":\"ai refused\"}"));

		assertThatThrownBy(() -> adapter.search(request(null)))
				.isInstanceOf(SearchException.class)
				.extracting(
						exception -> ((SearchException) exception).code(),
						exception -> ((SearchException) exception).status())
				.containsExactly(expectedCode, expectedStatus);
	}

	private static AiComposedSearchPort.Request request(String excludeProductId) {
		return new AiComposedSearchPort.Request(
				new byte[] { 1, 2, 3 },
				"image/png",
				"query.png",
				"đổi sang màu navy",
				4,
				"trace-1",
				new AiComposedSearchPort.Publication("catalog-v1", "model-v1", "index-v1"),
				"equal-weight-l2-v1",
				excludeProductId);
	}

	private static String successBody() {
		return """
				{
				  "schema_version": "1.0.0",
				  "trace_id": "trace-1",
				  "mode": "COMPOSED",
				  "publication": {
				    "catalog_snapshot_id": "catalog-v1",
				    "model_version": "model-v1",
				    "index_version": "index-v1"
				  },
				  "requested_k": 4,
				  "returned_k": 1,
				  "provenance": {
				    "artifact_scope": "PILOT_ONLY",
				    "model_config_hash": "cfghash",
				    "text_normalization_version": "nfc-whitespace-v1",
				    "text_overflow_policy": "RAW_CAP_ONLY",
				    "self_match_policy": "NONE",
				    "fusion": {
				      "fusion_version": "equal-weight-l2-v1",
				      "strategy": "WEIGHTED_SUM",
				      "image_weight": 0.5,
				      "text_weight": 0.5,
				      "component_normalization": "L2",
				      "output_normalization": "L2",
				      "similarity_metric": "NORMALIZED_INNER_PRODUCT"
				    }
				  },
				  "results": [
				    {"product_id": "p1", "product_version_id": "p1-v1", "rank": 1, "similarity_score": 0.9}
				  ],
				  "ai_latency_ms": 2.0
				}
				""";
	}
}
