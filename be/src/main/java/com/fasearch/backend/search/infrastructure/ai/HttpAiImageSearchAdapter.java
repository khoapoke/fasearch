package com.fasearch.backend.search.infrastructure.ai;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.search.application.AiImageSearchPort;
import com.fasearch.backend.search.application.SearchException;

@Component
public final class HttpAiImageSearchAdapter implements AiImageSearchPort {

	private final RestClient restClient;
	private final JsonMapper json;

	public HttpAiImageSearchAdapter(RestClient aiRestClient, JsonMapper json) {
		this.restClient = aiRestClient;
		this.json = json;
	}

	@Override
	public Response search(Request request) {
		MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
		parts.add("image", new NamedByteArrayResource(request.image(), request.filename()));
		parts.add("trace_id", request.traceId());
		parts.add("catalog_snapshot_id", request.publication().catalogSnapshotId());
		parts.add("model_version", request.publication().modelVersion());
		parts.add("index_version", request.publication().indexVersion());
		parts.add("k", Integer.toString(request.k()));

		try {
			AiResponse body = restClient.post()
					.uri("/internal/v1/search/image")
					.header("X-Trace-Id", request.traceId())
					.contentType(MediaType.MULTIPART_FORM_DATA)
					.accept(MediaType.APPLICATION_JSON)
					.body(parts)
					.retrieve()
					.onStatus(status -> status.value() == 400,
							(httpRequest, response) -> { throw mapBadRequest(response); })
					.onStatus(status -> status.value() == 409, (httpRequest, response) -> {
						throw new SearchException(
								"AI_PUBLICATION_MISMATCH",
								HttpStatus.SERVICE_UNAVAILABLE,
								"AI service rejected the active publication");
					})
					.onStatus(status -> status.value() == 413,
							(httpRequest, response) -> {
								throw unavailable("IMAGE_TOO_LARGE", HttpStatus.CONTENT_TOO_LARGE,
										"AI service rejected the image size");
							})
					.onStatus(status -> status.value() == 415,
							(httpRequest, response) -> {
								throw unavailable("INVALID_IMAGE", HttpStatus.UNSUPPORTED_MEDIA_TYPE,
										"AI service rejected the image content type");
							})
					.onStatus(status -> status.isError(), (httpRequest, response) -> {
						throw new SearchException(
								"AI_UNAVAILABLE",
								HttpStatus.SERVICE_UNAVAILABLE,
								"AI service could not complete image search");
					})
					.body(AiResponse.class);
			if (body == null) {
				throw unavailable("AI_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
						"AI service returned an empty response");
			}
			return body.toPortResponse();
		}
		catch (SearchException exception) {
			throw exception;
		}
		catch (RestClientException exception) {
			if (isTimeout(exception)) {
				throw unavailable("AI_TIMEOUT", HttpStatus.SERVICE_UNAVAILABLE,
						"AI service timed out on image search", exception);
			}
			if (hasJacksonCause(exception)) {
				throw unavailable("AI_CONTRACT_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
						"AI response failed image contract parsing", exception);
			}
			throw unavailable("AI_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
					"AI service is unavailable", exception);
		}
	}

	private SearchException mapBadRequest(ClientHttpResponse response) {
		String code = readAiCode(response);
		if ("INVALID_IMAGE".equals(code)) {
			return unavailable("INVALID_IMAGE", HttpStatus.BAD_REQUEST,
					"AI service rejected the query image");
		}
		if ("INVALID_REQUEST".equals(code)) {
			return unavailable("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"AI service rejected the image request");
		}
		if ("IMAGE_TOO_LARGE".equals(code)) {
			return unavailable("IMAGE_TOO_LARGE", HttpStatus.BAD_REQUEST,
					"AI service rejected the image size");
		}
		return unavailable("AI_CONTRACT_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
					"AI service returned an unknown bad-request code");
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


	@JsonIgnoreProperties(ignoreUnknown = true)
	private record AiResponse(
			@JsonProperty("schema_version") String schemaVersion,
			@JsonProperty("trace_id") String traceId,
			String mode,
			AiPublication publication,
			List<AiHit> results,
			@JsonProperty("ai_latency_ms") double aiLatencyMs,
			@JsonProperty("artifact_scope") String artifactScope) {

		private Response toPortResponse() {
			return new Response(
					new Publication(
							publication.catalogSnapshotId(),
							publication.modelVersion(),
							publication.indexVersion()),
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

	private record AiHit(
			@JsonProperty("product_id") String productId,
			@JsonProperty("product_version_id") String productVersionId,
			int rank,
			@JsonProperty("similarity_score") double similarityScore) {
	}
}
