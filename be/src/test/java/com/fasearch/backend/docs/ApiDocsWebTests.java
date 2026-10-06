package com.fasearch.backend.docs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasearch.backend.identity.SecurityConfiguration;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Local docs stay reachable without auth while API write protection is intact,
 * and the served contract stays byte-identical to the canonical file.
 */
@WebMvcTest(value = ApiDocsController.class,
		properties = "spring.security.user.password=unused-test-password")
@Import(SecurityConfiguration.class)
class ApiDocsWebTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void swaggerPageIsPublicAndPointsAtLocalContract() throws Exception {
		MvcResult result = mockMvc.perform(get("/docs"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
				.andReturn();
		String html = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
		assertThat(html)
				.contains("/webjars/swagger-ui/")
				.contains("/docs/openapi.json")
				.contains("withCredentials");
	}

	@Test
	void servedContractMatchesCanonicalFile() throws Exception {
		MvcResult result = mockMvc.perform(get("/docs/openapi.json"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andReturn();
		String served = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
		String canonical = Files.readString(Path.of("..", "contracts", "public-api.openapi.json"),
				StandardCharsets.UTF_8);
		assertThat(served).isEqualTo(canonical);

		JsonMapper json = new JsonMapper();
		JsonNode contract = json.readTree(served);
		assertThat(contract.get("paths").size()).isEqualTo(21);
		int operations = 0;
		for (JsonNode item : contract.get("paths")) {
			for (String method : new String[] { "get", "post", "put", "patch", "delete" }) {
				if (item.has(method)) {
					operations++;
				}
			}
		}
		assertThat(operations).isEqualTo(28);
	}

	@Test
	void draftWriteStillRequiresAuthentication() throws Exception {
		mockMvc.perform(post("/api/v1/catalog/admin/drafts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"No auth\",\"category\":\"TOP\"}"))
				.andExpect(status().is4xxClientError());
	}
}
