package com.fasearch.backend.search.infrastructure.ai;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasearch.backend.search.application.AiImageSearchPort;
import com.fasearch.backend.search.application.SearchException;

@Component
public final class HttpAiImageSearchAdapter implements AiImageSearchPort {

	private final RestClient restClient;

	public HttpAiImageSearchAdapter(RestClient aiRestClient) {
		this.restClient = aiRestClient;
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
					.onStatus(status -> status.value() == 409, (httpRequest, response) -> {
						throw new SearchException(
								"AI_PUBLICATION_MISMATCH",
								HttpStatus.SERVICE_UNAVAILABLE,
								"AI service rejected the active publication");
					})
					.onStatus(HttpStatusCode::isError, (httpRequest, response) -> {
						throw new SearchException(
								"AI_UNAVAILABLE",
								HttpStatus.SERVICE_UNAVAILABLE,
								"AI service could not complete image search");
					})
					.body(AiResponse.class);
			if (body == null) {
				throw new SearchException(
						"AI_UNAVAILABLE",
						HttpStatus.SERVICE_UNAVAILABLE,
						"AI service returned an empty response");
			}
			return body.toPortResponse();
		}
		catch (SearchException exception) {
			throw exception;
		}
		catch (RestClientException exception) {
			throw new SearchException(
					"AI_UNAVAILABLE",
					HttpStatus.SERVICE_UNAVAILABLE,
					"AI service is unavailable",
					exception);
		}
	}

	private static final class NamedByteArrayResource extends ByteArrayResource {

		private final String filename;

		private NamedByteArrayResource(byte[] bytes, String filename) {
			super(bytes);
			this.filename = filename == null || filename.isBlank() ? "query-image" : filename;
		}

		@Override
		public String getFilename() {
			return filename;
		}
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
