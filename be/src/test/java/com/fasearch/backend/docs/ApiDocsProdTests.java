package com.fasearch.backend.docs;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasearch.backend.identity.SecurityConfiguration;

/**
 * Documentation stays local-only: under the {@code prod} profile the docs
 * controller is not loaded, so the canonical contract is not served.
 */
@WebMvcTest(value = ApiDocsController.class,
		properties = "spring.security.user.password=unused-test-password")
@ActiveProfiles("prod")
@Import(SecurityConfiguration.class)
class ApiDocsProdTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void docsAreUnavailableUnderProdProfile() throws Exception {
		MvcResult result = mockMvc.perform(get("/docs/openapi.json")).andReturn();
		int status = result.getResponse().getStatus();
		org.assertj.core.api.Assertions.assertThat(status).isNotEqualTo(200);
	}
}
