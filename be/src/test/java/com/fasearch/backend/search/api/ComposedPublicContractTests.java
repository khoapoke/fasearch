package com.fasearch.backend.search.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.StreamSupport;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class ComposedPublicContractTests {

	private static final JsonMapper JSON = new JsonMapper();

	private static JsonNode contract() throws IOException {
		Path contractPath = Path.of("..", "contracts", "public-api.openapi.json");
		return JSON.readTree(Files.readString(contractPath));
	}

	private static List<String> texts(JsonNode node) {
		return StreamSupport.stream(node.spliterator(), false)
				.map(JsonNode::asText)
				.toList();
	}

	@Test
	void composedPathExposesExactlyOneBranchPerRequest() throws IOException {
		JsonNode post = contract()
				.path("paths").path("/api/v1/search/composed").path("post");

		assertThat(post.path("operationId").asText()).isEqualTo("searchByComposed");
		assertThat(texts(post.path("requestBody").path("content")
				.path("multipart/form-data").path("schema").path("required")))
				.containsExactlyInAnyOrder("schema_version", "modification_text");
		assertThat(post.path("requestBody").path("content")
				.path("multipart/form-data").path("schema").path("properties")
				.path("k").path("default").asInt()).isEqualTo(10);
		assertThat(post.path("responses").path("200").path("content")
				.path("application/json").path("schema").path("$ref").asText())
				.isEqualTo("#/components/schemas/ComposedSearchResponse");
		assertThat(post.path("responses").path("403").path("$ref").asText())
				.isEqualTo("#/components/responses/AuthError");
		for (String status : new String[] { "400", "404", "409", "413", "415", "503" }) {
			assertThat(post.path("responses").path(status).path("$ref").asText())
					.isEqualTo("#/components/responses/ComposedError");
		}
	}

	@Test
	void composedSchemasPinModeReferenceAndErrorCodes() throws IOException {
		JsonNode schemas = contract().path("components").path("schemas");

		assertThat(schemas.path("ComposedSearchResponse").path("properties")
				.path("mode").path("const").asText()).isEqualTo("COMPOSED");
		assertThat(texts(schemas.path("ComposedSearchResponse").path("required")))
				.contains("requested_k", "returned_k", "reference", "provenance");
		assertThat(schemas.path("ComposedReference").path("oneOf")).hasSize(2);
		assertThat(texts(schemas.path("ComposedProvenance").path("properties")
				.path("text_overflow_policy").path("enum")))
				.containsExactlyInAnyOrder("REJECT_MODEL_LIMIT", "RAW_CAP_ONLY");
		assertThat(texts(schemas.path("ComposedProvenance").path("properties")
				.path("self_match_policy").path("enum")))
				.containsExactlyInAnyOrder("NONE", "EXCLUDE_ANCHOR_PRODUCT");
		assertThat(texts(schemas.path("ComposedErrorResponse").path("properties")
				.path("code").path("enum")))
				.containsExactlyInAnyOrder(
						"INVALID_REQUEST", "INVALID_IMAGE", "IMAGE_TOO_LARGE", "TEXT_TOO_LONG",
						"ANCHOR_PUBLICATION_MISMATCH", "ANCHOR_NOT_AVAILABLE", "CATALOG_UNAVAILABLE",
						"AI_UNAVAILABLE", "AI_TIMEOUT", "AI_PUBLICATION_MISMATCH", "AI_FUSION_MISMATCH",
						"AI_CONTRACT_MISMATCH", "CATALOG_VERSION_MISMATCH");
	}
}
