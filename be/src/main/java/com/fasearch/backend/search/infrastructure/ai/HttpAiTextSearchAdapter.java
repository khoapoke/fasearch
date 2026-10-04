package com.fasearch.backend.search.infrastructure.ai;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.search.application.AiTextSearchPort;
import com.fasearch.backend.search.application.SearchException;

@Component
public final class HttpAiTextSearchAdapter implements AiTextSearchPort {

	private final RestClient restClient;
	private final JsonMapper json;

	public HttpAiTextSearchAdapter(RestClient aiRestClient, JsonMapper json) {
		this.restClient = aiRestClient;
		this.json = json;
	}

	@Override
	public Response search(Request request) {
		TextInternalRequest body = new TextInternalRequest(
				"1.0.0",
				request.queryText(),
				request.k(),
				request.traceId(),
				request.publication().catalogSnapshotId(),
				request.publication().modelVersion(),
				request.publication().indexVersion());
		try {
			AiResponse aiBody = restClient.post()
					.uri("/internal/v1/search/text")
					.header("X-Trace-Id", request.traceId())
					.contentType(MediaType.APPLICATION_JSON)
					.accept(MediaType.APPLICATION_JSON)
					.body(body)
					.retrieve()
					.onStatus(status -> status.value() == 400,
							(httpRequest, resp) -> { throw mapBadRequest(resp); })
					.onStatus(status -> status.value() == 409,
							(httpRequest, resp) -> { throw mapConflict(resp); })
					.onStatus(status -> status.value() == 413,
							(httpRequest, resp) -> {
								throw unavailable("INVALID_REQUEST", HttpStatus.CONTENT_TOO_LARGE,
										"AI service rejected the text body size");
							})
					.onStatus(status -> status.value() == 422,
							(httpRequest, resp) -> {
								throw unavailable("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
										"AI service rejected the text request");
							})
					.onStatus(status -> status.isError(),
							(httpRequest, resp) -> {
								throw unavailable("AI_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
										"AI service could not complete text search");
							})
					.body(AiResponse.class);
			if (aiBody == null) {
				throw unavailable("AI_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
						"AI service returned an empty response");
			}
			return aiBody.toPortResponse();
		}
		catch (SearchException exception) {
			throw exception;
		}
		catch (RestClientException exception) {
			if (isTimeout(exception)) {
				throw unavailable("AI_TIMEOUT", HttpStatus.SERVICE_UNAVAILABLE,
						"AI service timed out on text search", exception);
			}
			if (hasJacksonCause(exception)) {
				throw unavailable("AI_CONTRACT_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
						"AI response failed text contract parsing", exception);
			}
			throw unavailable("AI_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
					"AI service is unavailable", exception);
		}
	}

	private SearchException mapBadRequest(ClientHttpResponse response) {
		String code = readAiCode(response);
		if ("TEXT_TOO_LONG".equals(code)) {
			return unavailable("TEXT_TOO_LONG", HttpStatus.BAD_REQUEST,
					"AI service rejected the query text length");
		}
		if ("INVALID_REQUEST".equals(code)) {
			return unavailable("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"AI service rejected the text request");
		}
		return unavailable("AI_CONTRACT_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
				"AI service returned an unknown bad-request code");
	}

	private SearchException mapConflict(ClientHttpResponse response) {
		String code = readAiCode(response);
		if ("PUBLICATION_MISMATCH".equals(code)) {
			return unavailable("AI_PUBLICATION_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
					"AI service rejected the active publication");
		}
		return unavailable("AI_CONTRACT_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
				"AI service returned an unknown conflict code");
	}

	private String readAiCode(ClientHttpResponse response) {
		try {
			String body = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
			return json.readTree(body).path("code").asText("");
		}
		catch (IOException | RuntimeException exception) {
			return "";
		}
	}

	private static boolean isTimeout(Throwable throwable) {
		Throwable current = throwable;
		while (current != null) {
			String name = current.getClass().getName();
			if (name.contains("Timeout") || name.contains("timeout")) {
				return true;
			}
			current = current.getCause();
		}
		return false;
	}

	private static boolean hasJacksonCause(Throwable throwable) {
		Throwable current = throwable;
		while (current != null) {
			if (current.getClass().getName().startsWith("tools.jackson.")) {
				return true;
			}
			current = current.getCause();
		}
		return false;
	}

	private static SearchException unavailable(
			String code, HttpStatus status, String message) {
		return new SearchException(code, status, message);
	}

	private static SearchException unavailable(
			String code, HttpStatus status, String message, Throwable cause) {
		return new SearchException(code, status, message, cause);
	}

	private record TextInternalRequest(
			@JsonProperty("schema_version") String schemaVersion,
			@JsonProperty("query_text") String queryText,
			int k,
			@JsonProperty("trace_id") String traceId,
			@JsonProperty("catalog_snapshot_id") String catalogSnapshotId,
			@JsonProperty("model_version") String modelVersion,
			@JsonProperty("index_version") String indexVersion) {
	}

	private record AiResponse(
			@JsonProperty("schema_version") String schemaVersion,
			@JsonProperty("trace_id") String traceId,
			String mode,
			AiPublication publication,
			@JsonProperty("requested_k") int requestedK,
			@JsonProperty("returned_k") int returnedK,
			AiProvenance provenance,
			List<AiHit> results,
			@JsonProperty("ai_latency_ms") double aiLatencyMs) {

		private Response toPortResponse() {
			return new Response(
					schemaVersion,
					traceId,
					mode,
					new Publication(
							publication.catalogSnapshotId(),
							publication.modelVersion(),
							publication.indexVersion()),
					requestedK,
					returnedK,
					new Provenance(
							provenance.artifactScope(),
							provenance.modelConfigHash(),
							provenance.textNormalizationVersion(),
							provenance.textOverflowPolicy()),
					results.stream()
							.map(hit -> new Hit(
									hit.productId(),
									hit.productVersionId(),
									hit.rank(),
									hit.similarityScore()))
							.toList(),
					aiLatencyMs);
		}
	}

	private record AiPublication(
			@JsonProperty("catalog_snapshot_id") String catalogSnapshotId,
			@JsonProperty("model_version") String modelVersion,
			@JsonProperty("index_version") String indexVersion) {
	}

	private record AiProvenance(
			@JsonProperty("artifact_scope") String artifactScope,
			@JsonProperty("model_config_hash") String modelConfigHash,
			@JsonProperty("text_normalization_version") String textNormalizationVersion,
			@JsonProperty("text_overflow_policy") String textOverflowPolicy) {
	}

	private record AiHit(
			@JsonProperty("product_id") String productId,
			@JsonProperty("product_version_id") String productVersionId,
			int rank,
			@JsonProperty("similarity_score") double similarityScore) {
	}
}
