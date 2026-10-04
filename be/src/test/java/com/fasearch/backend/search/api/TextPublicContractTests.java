package com.fasearch.backend.search.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class TextPublicContractTests {

	private static final JsonMapper JSON = new JsonMapper();

	private static JsonNode contract() throws IOException {
		Path contractPath = Path.of("..", "contracts", "public-api.openapi.json");
		return JSON.readTree(Files.readString(contractPath));
	}

	@Test
	void textPathExposesJsonContract() throws IOException {
		JsonNode post = contract().path("paths").path("/api/v1/search/text").path("post");

		assertThat(post.path("operationId").asText()).isEqualTo("searchByText");
		assertThat(post.path("requestBody").path("content")
				.path("application/json").path("schema").path("$ref").asText())
				.isEqualTo("#/components/schemas/TextSearchRequest");
		assertThat(post.path("responses").path("200").path("content")
				.path("application/json").path("schema").path("$ref").asText())
				.isEqualTo("#/components/schemas/TextSearchResponse");
	}

	@Test
	void textSchemasPinModeAndProvenance() throws IOException {
		JsonNode schemas = contract().path("components").path("schemas");

		assertThat(schemas.path("TextSearchResponse").path("properties")
				.path("mode").path("const").asText()).isEqualTo("TEXT");
		assertThat(schemas.path("TextProvenance").path("properties")
				.path("text_overflow_policy").path("enum").toString())
				.contains("RAW_CAP_ONLY");
		assertThat(schemas.path("TextSearchRequest").path("additionalProperties").asBoolean())
				.isFalse();
	}
}
