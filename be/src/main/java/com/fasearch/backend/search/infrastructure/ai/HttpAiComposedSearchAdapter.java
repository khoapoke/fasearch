package com.fasearch.backend.search.infrastructure.ai;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.http.client.MultipartBodyBuilder;

import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.search.application.AiComposedSearchPort;
import com.fasearch.backend.search.application.SearchException;

@Component
public final class HttpAiComposedSearchAdapter implements AiComposedSearchPort {

	private final RestClient restClient;
	private final JsonMapper json;

	public HttpAiComposedSearchAdapter(RestClient aiRestClient, JsonMapper json) {
		this.restClient = aiRestClient;
		this.json = json;
	}

	@Override
	public Response search(Request request) {
		MultipartBodyBuilder builder = new MultipartBodyBuilder();
		builder.part(
				"image",
				new NamedByteArrayResource(request.image(), request.filename()),
				MediaType.parseMediaType(request.contentType()));
		builder.part("schema_version", "1.0.0");
		builder.part("modification_text", request.modificationText());
		builder.part("trace_id", request.traceId());
		builder.part("catalog_snapshot_id", request.publication().catalogSnapshotId());
		builder.part("model_version", request.publication().modelVersion());
		builder.part("index_version", request.publication().indexVersion());
		builder.part("fusion_version", request.fusionVersion());
		if (request.excludeProductId() != null) {
			builder.part("exclude_product_id", request.excludeProductId());
		}
		builder.part("k", Integer.toString(request.k()));
		MultiValueMap<String, org.springframework.http.HttpEntity<?>> parts = builder.build();

		try {
			AiResponse body = restClient.post()
					.uri("/internal/v1/search/composed")
					.header("X-Trace-Id", request.traceId())
					.contentType(MediaType.MULTIPART_FORM_DATA)
					.accept(MediaType.APPLICATION_JSON)
					.body(parts)
					.retrieve()
					.onStatus(status -> status.value() == 400,
							(httpRequest, response) -> { throw mapBadRequest(response); })
					.onStatus(status -> status.value() == 409,
							(httpRequest, response) -> { throw mapConflict(response); })
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
					.onStatus(status -> status.value() == 422,
							(httpRequest, response) -> {
								throw unavailable("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
										"AI service rejected the composed request");
							})
					.onStatus(status -> status.isError(),
							(httpRequest, response) -> {
								throw unavailable("AI_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
										"AI service could not complete composed search");
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
						"AI service timed out on composed search", exception);
			}
			if (hasJacksonCause(exception)) {
				throw unavailable("AI_CONTRACT_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
						"AI response failed composed contract parsing", exception);
			}
			throw unavailable("AI_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
					"AI service is unavailable", exception);
		}
	}

	private SearchException mapBadRequest(ClientHttpResponse response) {
		String code = readAiCode(response);
		if ("INVALID_REQUEST".equals(code)) {
			return unavailable("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"AI service rejected the composed request");
		}
		if ("INVALID_IMAGE".equals(code)) {
			return unavailable("INVALID_IMAGE", HttpStatus.BAD_REQUEST,
					"AI service rejected the composed image");
		}
		if ("TEXT_TOO_LONG".equals(code)) {
			return unavailable("TEXT_TOO_LONG", HttpStatus.BAD_REQUEST,
					"AI service rejected the modification text length");
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
		if ("FUSION_VERSION_MISMATCH".equals(code)) {
			return unavailable("AI_FUSION_MISMATCH", HttpStatus.SERVICE_UNAVAILABLE,
					"AI service rejected the fusion version");
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
							provenance.textOverflowPolicy(),
							provenance.selfMatchPolicy(),
							new Fusion(
									provenance.fusion().fusionVersion(),
									provenance.fusion().strategy(),
									provenance.fusion().imageWeight(),
									provenance.fusion().textWeight(),
									provenance.fusion().componentNormalization(),
									provenance.fusion().outputNormalization(),
									provenance.fusion().similarityMetric())),
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
			@JsonProperty("text_overflow_policy") String textOverflowPolicy,
			@JsonProperty("self_match_policy") String selfMatchPolicy,
			AiFusion fusion) {
	}

	private record AiFusion(
			@JsonProperty("fusion_version") String fusionVersion,
			String strategy,
			@JsonProperty("image_weight") double imageWeight,
			@JsonProperty("text_weight") double textWeight,
			@JsonProperty("component_normalization") String componentNormalization,
			@JsonProperty("output_normalization") String outputNormalization,
			@JsonProperty("similarity_metric") String similarityMetric) {
	}

	private record AiHit(
			@JsonProperty("product_id") String productId,
			@JsonProperty("product_version_id") String productVersionId,
			int rank,
			@JsonProperty("similarity_score") double similarityScore) {
	}
}
