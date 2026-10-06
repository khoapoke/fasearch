package com.fasearch.backend.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.json.JsonMapper;

// S3 tracer: validation bounds, malformed/unknown fields, CSRF denial, 415.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class AccountRegisterValidationIntegrationTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer database = new PostgreSQLContainer("postgres:16-alpine");

	@org.springframework.beans.factory.annotation.Value("${local.server.port}")
	int port;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	JsonMapper json;

	@Test
	void boundsAndUnknownFieldsAreRejected() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		// username too short / bad chars.
		assertThat(post(base, "{\"username\":\"ab\",\"email\":\"a@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\"}").statusCode()).isEqualTo(400);
		assertThat(post(base, "{\"username\":\"bad user!\",\"email\":\"a@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\"}").statusCode()).isEqualTo(400);
		// email invalid / too long.
		assertThat(post(base, "{\"username\":\"valid_user\",\"email\":\"not-an-email\","
				+ "\"password\":\"a-very-long-test-passphrase-01\"}").statusCode()).isEqualTo(400);
		// control characters are rejected even where trim would strip them.
		assertThat(post(base, "{\"username\":\"ctrl_user\",\"email\":\"a\t@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\"}").statusCode()).isEqualTo(400);
		assertThat(post(base, "{\"username\":\"ctrl_user\",\"email\":\"a\n@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\"}").statusCode()).isEqualTo(400);
		assertThat(post(base, "{\"username\":\"ctrl_user\",\"email\":\"a@example.test\\u0007\","
				+ "\"password\":\"a-very-long-test-passphrase-01\"}").statusCode()).isEqualTo(400);
		assertThat(post(base, "{\"username\":\"ctrl_user\",\"email\":\"  spaced@example.test  \","
				+ "\"password\":\"a-very-long-test-passphrase-01\"}").statusCode()).isEqualTo(201);
		// password too short.
		assertThat(post(base, "{\"username\":\"valid_user\",\"email\":\"a@example.test\","
				+ "\"password\":\"short\"}").statusCode()).isEqualTo(400);
		// password over 72 UTF-8 bytes (18 x 4-byte emoji = 72 cp? use 20 emoji = 80 bytes).
		String longEmoji = "😀".repeat(20);
		HttpResponse<String> byteBound = post(base, "{\"username\":\"valid_user\","
				+ "\"email\":\"a@example.test\",\"password\":\"" + longEmoji + "\"}");
		assertThat(byteBound.statusCode()).isEqualTo(400);
		assertThat(json.readTree(byteBound.body()).get("code").asText())
				.isEqualTo("VALIDATION_ERROR");
		// display_name blank / control char.
		assertThat(post(base, "{\"username\":\"valid_user\",\"email\":\"a@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\",\"display_name\":\"   \"}")
				.statusCode()).isEqualTo(400);
		assertThat(post(base, "{\"username\":\"valid_user\",\"email\":\"a@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\",\"display_name\":\"a\\u0007b\"}")
				.statusCode()).isEqualTo(400);
		// unknown + protected fields rejected, not ignored.
		assertThat(post(base, "{\"username\":\"valid_user\",\"email\":\"a@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\",\"role\":\"ADMINISTRATOR\"}")
				.statusCode()).isEqualTo(400);
		assertThat(post(base, "{\"username\":\"valid_user\",\"email\":\"a@example.test\","
				+ "\"password\":\"a-very-long-test-passphrase-01\",\"status\":\"ACTIVE\",\"extra\":1}")
				.statusCode()).isEqualTo(400);
		// malformed JSON.
		assertThat(post(base, "{not-json").statusCode()).isEqualTo(400);
		// No account persisted from any rejected attempt.
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM user_accounts WHERE LOWER(username) = 'valid_user'",
				Integer.class)).isEqualTo(0);
	}

	@Test
	void csrfAndContentTypeAreEnforced() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		// Ensure session exists, then POST without CSRF -> 403.
		browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString());
		HttpResponse<String> denied = browser.send(HttpRequest
				.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"u1\",\"email\":\"u1@example.test\","
						+ "\"password\":\"a-very-long-test-passphrase-01\"}")).build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(denied.statusCode()).isEqualTo(403);
		// Wrong content type -> 415.
		String csrf = json.readTree(browser.send(
				HttpRequest.newBuilder(base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		HttpResponse<String> unsupported = browser.send(HttpRequest
				.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "text/plain")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString("hello")).build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(unsupported.statusCode()).isEqualTo(415);
		HttpResponse<String> jsonRetry = browser.send(HttpRequest
				.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"probe_user\",\"email\":\"probe@example.test\",\"password\":\"a-very-long-test-passphrase-01\"}")).build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(jsonRetry.statusCode()).isEqualTo(201);
		CookieManager freshCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient fresh = HttpClient.newBuilder().cookieHandler(freshCookies).build();
		String freshCsrf = json.readTree(fresh.send(HttpRequest.newBuilder(
				base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		HttpResponse<String> freshPlain = fresh.send(HttpRequest
				.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "text/plain")
				.header("X-CSRF-TOKEN", freshCsrf)
				.POST(HttpRequest.BodyPublishers.ofString("hello")).build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(freshPlain.statusCode()).isEqualTo(415);
	}

	private HttpResponse<String> post(URI base, String payload) throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		String csrf = json.readTree(browser.send(HttpRequest.newBuilder(
				base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		return browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(payload)).build(),
				HttpResponse.BodyHandlers.ofString());
	}
}
