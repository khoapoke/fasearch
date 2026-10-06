package com.fasearch.backend.library;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;

import tools.jackson.databind.json.JsonMapper;

// A product saved while public, then gone from the current publication:
// listed with an unavailable marker (no stale metadata) and still removable.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123",
		"FASEARCH_CATALOG_FILE=src/test/resources/library-catalog-single.jsonl",
		"FASEARCH_CATALOG_SNAPSHOT_ID=catalog-test-v1",
		"FASEARCH_MODEL_VERSION=model-test-v1",
		"FASEARCH_INDEX_VERSION=index-test-v1"
})
class LibrarySavedUnavailableIntegrationTests {

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
	void archivedProductListsAsUnavailableButRemovable() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		String csrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		HttpResponse<String> registered = send(browser, HttpRequest.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(
						"{\"username\":\"lib_ghost\",\"email\":\"lib_ghost@example.test\","
								+ "\"password\":\"a-very-long-test-passphrase-01\",\"display_name\":null}"))
				.build());
		assertThat(registered.statusCode()).isEqualTo(201);
		String loginCsrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		assertThat(send(browser, HttpRequest.newBuilder(base.resolve("/api/v1/auth/login"))
				.header("Content-Type", "application/x-www-form-urlencoded")
				.header("X-CSRF-TOKEN", loginCsrf)
				.POST(HttpRequest.BodyPublishers.ofString(
						"username=lib_ghost&password=a-very-long-test-passphrase-01"))
				.build()).statusCode()).isEqualTo(200);
		String sessionCsrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();

		// Simulate a bookmark whose product later left the publication.
		UUID accountId = jdbc.queryForObject(
				"SELECT id FROM user_accounts WHERE LOWER(username) = 'lib_ghost'", UUID.class);
		jdbc.update("INSERT INTO saved_products (account_id, product_id, product_version_id) "
				+ "VALUES (?, 'ghost-p9', 'ghost-p9-v7')", accountId);
		assertThat(send(browser, HttpRequest.newBuilder(base.resolve("/api/v1/me/saved-products/p1"))
				.header("X-CSRF-TOKEN", sessionCsrf)
				.PUT(HttpRequest.BodyPublishers.noBody()).build()).statusCode()).isEqualTo(204);

		HttpResponse<String> listed = send(browser, get(base, "/api/v1/me/saved-products?size=20"));
		assertThat(listed.statusCode()).isEqualTo(200);
		assertThat(json.readTree(listed.body()).get("total").asInt()).isEqualTo(2);
		var items = json.readTree(listed.body()).get("items");
		boolean ghostSeen = false;
		for (var item : items) {
			if (item.get("product_id").asText().equals("ghost-p9")) {
				ghostSeen = true;
				assertThat(item.get("available").asBoolean()).isFalse();
				assertThat(item.get("product").isNull()).isTrue();
				assertThat(item.toString()).doesNotContain("ghost-p9-v7");
			}
		}
		assertThat(ghostSeen).isTrue();

		HttpResponse<String> removed = send(browser, HttpRequest.newBuilder(
				base.resolve("/api/v1/me/saved-products/ghost-p9"))
				.header("X-CSRF-TOKEN", sessionCsrf).DELETE().build());
		assertThat(removed.statusCode()).isEqualTo(204);
		assertThat(json.readTree(send(browser, get(base, "/api/v1/me/saved-products?size=20")).body())
				.get("total").asInt()).isEqualTo(1);
	}

	static HttpRequest get(URI base, String path) {
		return HttpRequest.newBuilder(base.resolve(path)).GET().build();
	}

	static HttpResponse<String> send(HttpClient browser, HttpRequest request) throws Exception {
		return browser.send(request, HttpResponse.BodyHandlers.ofString());
	}
}
