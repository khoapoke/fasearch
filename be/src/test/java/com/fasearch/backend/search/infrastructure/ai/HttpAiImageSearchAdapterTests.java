package com.fasearch.backend.search.infrastructure.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.fasearch.backend.search.application.AiImageSearchPort;
import com.fasearch.backend.search.application.SearchException;

class HttpAiImageSearchAdapterTests {

	private MockRestServiceServer server;
	private HttpAiImageSearchAdapter adapter;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.local");
		server = MockRestServiceServer.bindTo(builder).build();
		adapter = new HttpAiImageSearchAdapter(builder.build());
	}

	@Test
	void mapsTheVersionedAiResponseToTheApplicationPort() {
		server.expect(once(), requestTo("http://ai.local/internal/v1/search/image"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("X-Trace-Id", "trace-1"))
				.andRespond(withSuccess("""
						{
						  "schema_version": "1.0.0",
						  "trace_id": "trace-1",
						  "mode": "IMAGE",
						  "publication": {
						    "catalog_snapshot_id": "catalog-v1",
						    "model_version": "model-v1",
						    "index_version": "index-v1"
						  },
						  "results": [{
						    "product_id": "p1",
						    "product_version_id": "p1-v1",
						    "rank": 1,
						    "similarity_score": 0.91
						  }],
						  "ai_latency_ms": 2.5,
						  "artifact_scope": "PILOT_ONLY"
						}
						""", MediaType.APPLICATION_JSON));

		AiImageSearchPort.Response response = adapter.search(request());

		server.verify();
		assertThat(response.publication().indexVersion()).isEqualTo("index-v1");
		assertThat(response.results()).hasSize(1);
		assertThat(response.results().get(0).productId()).isEqualTo("p1");
		assertThat(response.aiLatencyMs()).isEqualTo(2.5);
	}

	@Test
	void mapsPublicationMismatchToServiceUnavailable() {
		server.expect(once(), requestTo("http://ai.local/internal/v1/search/image"))
				.andRespond(withStatus(HttpStatus.CONFLICT)
						.contentType(MediaType.APPLICATION_JSON)
						.body("""
								{"code":"PUBLICATION_MISMATCH","message":"mismatch"}
								"""));

		assertThatThrownBy(() -> adapter.search(request()))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("AI_PUBLICATION_MISMATCH");
		server.verify();
	}

	private static AiImageSearchPort.Request request() {
		return new AiImageSearchPort.Request(
				new byte[] { 1, 2, 3 },
				"image/png",
				"query.png",
				10,
				"trace-1",
				new AiImageSearchPort.Publication("catalog-v1", "model-v1", "index-v1"));
	}
}
