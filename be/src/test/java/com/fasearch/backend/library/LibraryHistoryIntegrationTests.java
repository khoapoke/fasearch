package com.fasearch.backend.library;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;

import com.fasearch.backend.search.application.AiComposedSearchPort;
import com.fasearch.backend.search.application.AiImageSearchPort;
import com.fasearch.backend.search.application.AiTextSearchPort;

import tools.jackson.databind.json.JsonMapper;

// History RED→GREEN: default OFF, explicit opt-in, all three modes, no raw uploads.
// AI system-boundary ports are faked with labels; HTTP+JDBC+security seams are real.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123",
		"FASEARCH_CATALOG_FILE=src/test/resources/library-catalog.jsonl",
		"FASEARCH_CATALOG_SNAPSHOT_ID=catalog-test-v1",
		"FASEARCH_MODEL_VERSION=model-test-v1",
		"FASEARCH_INDEX_VERSION=index-test-v1"
})
class LibraryHistoryIntegrationTests {

	// Labelled test-only AI doubles: deterministic hits on the library fixture catalog.
	@TestConfiguration
	static class LabelledAiDoubles {
		@Bean
		@Primary
		AiTextSearchPort textDouble() {
			return request -> new AiTextSearchPort.Response(
					"1.0.0", request.traceId(), "TEXT", request.publication(),
					request.k(), 1,
					new AiTextSearchPort.Provenance("PILOT_ONLY", "hash-test", "nfc-whitespace-v1", "RAW_CAP_ONLY"),
					List.of(new AiTextSearchPort.Hit("p1", "p1-v1", 1, 0.9)),
					1.0);
		}

		@Bean
		@Primary
		AiImageSearchPort imageDouble() {
			return request -> new AiImageSearchPort.Response(
					request.publication(),
					List.of(new AiImageSearchPort.Hit("p2", "p2-v1", 1, 0.8)),
					1.0);
		}

		@Bean
		@Primary
		AiComposedSearchPort composedDouble() {
			return request -> new AiComposedSearchPort.Response(
					"1.0.0", request.traceId(), "COMPOSED", request.publication(),
					request.k(), 1,
					new AiComposedSearchPort.Provenance("PILOT_ONLY", "hash-test", "nfc-whitespace-v1",
							"RAW_CAP_ONLY", "NONE",
							new AiComposedSearchPort.Fusion("equal-weight-l2-v1", "weighted", 0.7, 0.3,
									"l2", "none", "cosine")),
					List.of(new AiComposedSearchPort.Hit("p3", "p3-v1", 1, 0.85)),
					1.0);
		}
	}

	@Container
	@ServiceConnection
	static PostgreSQLContainer database = new PostgreSQLContainer("postgres:16-alpine");

	@org.springframework.beans.factory.annotation.Value("${local.server.port}")
	int port;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	JsonMapper json;

	@Autowired
	LibraryModule library;

	@Test
	void historyRecordingIsOffByDefaultAndGuestNeverRecords() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient guest = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		String csrf = json.readTree(send(guest, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		int before = historyRows();

		HttpResponse<String> search = send(guest, postJson(base, "/api/v1/search/text",
				"{\"schema_version\":\"1.0.0\",\"query_text\":\"váy hoa\",\"k\":5}", csrf));
		assertThat(search.statusCode()).isEqualTo(200);
		assertThat(search.headers().firstValue("X-History-Status")).hasValue("NOT_RECORDED");
		assertThat(historyRows()).isEqualTo(before);

		// Explicit authenticated user without opt-in: still zero rows.
		CookieManager userCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(userCookies).build();
		register(browser, base, "hist_quiet", "hist_quiet@example.test");
		String userCsrf = login(browser, base, "hist_quiet");
		HttpResponse<String> prefs = send(browser, get(base, "/api/v1/me/library-preferences"));
		assertThat(prefs.statusCode()).isEqualTo(200);
		assertThat(json.readTree(prefs.body()).get("record_history").asBoolean()).isFalse();
		HttpResponse<String> own = send(browser, postJson(base, "/api/v1/search/text",
				"{\"schema_version\":\"1.0.0\",\"query_text\":\"váy hoa\",\"k\":5}", userCsrf));
		assertThat(own.statusCode()).isEqualTo(200);
		assertThat(own.headers().firstValue("X-History-Status")).hasValue("NOT_RECORDED");
		assertThat(historyRowsFor("hist_quiet")).isEqualTo(0);
	}

	@Test
	void explicitOptInRecordsTextSearchWithServerDerivedProvenance() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "hist_writer", "hist_writer@example.test");
		String csrf = login(browser, base, "hist_writer");

		HttpResponse<String> patched = send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":true}", csrf));
		assertThat(patched.statusCode()).isEqualTo(200);
		assertThat(json.readTree(patched.body()).get("record_history").asBoolean()).isTrue();

		HttpResponse<String> search = send(browser, postJson(base, "/api/v1/search/text",
				"{\"schema_version\":\"1.0.0\",\"query_text\":\"váy hoa\",\"k\":5}", csrf));
		assertThat(search.statusCode()).isEqualTo(200);
		assertThat(search.headers().firstValue("X-History-Status")).hasValue("RECORDED");

		assertThat(historyRowsFor("hist_writer")).isEqualTo(1);
		var row = jdbc.queryForMap(
				"SELECT mode, query_text, result_count, catalog_snapshot_id, model_version, "
						+ "index_version, result_refs::text AS refs FROM search_history h "
						+ "JOIN user_accounts u ON u.id = h.account_id "
						+ "WHERE LOWER(u.username) = 'hist_writer'");
		assertThat(row.get("mode")).isEqualTo("TEXT");
		assertThat(row.get("query_text")).isEqualTo("váy hoa");
		assertThat(row.get("result_count")).isEqualTo(1);
		assertThat(row.get("catalog_snapshot_id")).isEqualTo("catalog-test-v1");
		assertThat(row.get("model_version")).isEqualTo("model-test-v1");
		assertThat(row.get("index_version")).isEqualTo("index-test-v1");
		assertThat(row.get("refs").toString()).contains("p1").contains("p1-v1");
	}

	@Test
	void optedInImageAndComposedSearchesRecordWithoutRawUploads() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "hist_multi", "hist_multi@example.test");
		String csrf = login(browser, base, "hist_multi");
		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":true}", csrf)).statusCode())
				.isEqualTo(200);

		byte[] png = java.nio.file.Files.readAllBytes(
				java.nio.file.Path.of("src/test/resources/library-fixture.png"));
		HttpResponse<String> image = send(browser, postMultipart(base, "/api/v1/search/image",
				png, "query.png", "image/png", null, csrf));
		assertThat(image.statusCode()).isEqualTo(200);
		assertThat(image.headers().firstValue("X-History-Status")).hasValue("RECORDED");

		HttpResponse<String> composed = send(browser, postMultipart(base, "/api/v1/search/composed",
				png, "query.png", "image/png", "tay dài", csrf));
		assertThat(composed.statusCode()).isEqualTo(200);
		assertThat(composed.headers().firstValue("X-History-Status")).hasValue("RECORDED");

		assertThat(historyRowsFor("hist_multi")).isEqualTo(2);
		var modes = jdbc.queryForList(
				"SELECT mode FROM search_history h JOIN user_accounts u ON u.id = h.account_id "
						+ "WHERE LOWER(u.username) = 'hist_multi' ORDER BY h.created_at, h.id",
				String.class);
		assertThat(modes).containsExactly("IMAGE", "COMPOSED");
		// No upload bytes, no private paths, no secrets retained anywhere in history.
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM search_history h JOIN user_accounts u ON u.id = h.account_id "
						+ "WHERE LOWER(u.username) = 'hist_multi' AND h.query_text IS NULL",
				Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject(
				"SELECT COALESCE(string_agg(result_refs::text, ' '), '') FROM search_history h "
					+ "JOIN user_accounts u ON u.id = h.account_id "
					+ "WHERE LOWER(u.username) = 'hist_multi'",
				String.class))
				.doesNotContain("base64", "FASEARCH_SESSION", ".png\"")
				.contains("p2").contains("p3");
		assertThat(jdbc.queryForObject(
				"SELECT query_text FROM search_history h JOIN user_accounts u ON u.id = h.account_id "
					+ "WHERE LOWER(u.username) = 'hist_multi' AND h.mode = 'COMPOSED'",
				String.class)).isEqualTo("tay dài");
	}

	@Test
	void sessionImageSearchWithoutCsrfTokenIsRejectedWithNoHistory() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "hist_stale", "hist_stale@example.test");
		String csrf = login(browser, base, "hist_stale");
		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":true}", csrf)).statusCode())
				.isEqualTo(200);

		byte[] png = java.nio.file.Files.readAllBytes(
				java.nio.file.Path.of("src/test/resources/library-fixture.png"));
		// Stale/missing mutation authorization: rejected, nothing stored.
		HttpResponse<String> rejected = send(browser, postMultipart(base, "/api/v1/search/image",
				png, "query.png", "image/png", null, null));
		assertThat(rejected.statusCode()).isEqualTo(403);
		assertThat(historyRowsFor("hist_stale")).isEqualTo(0);
	}

	@Test
	void failedSearchesRecordNothing() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "hist_fail", "hist_fail@example.test");
		String csrf = login(browser, base, "hist_fail");
		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":true}", csrf)).statusCode())
				.isEqualTo(200);
		int before = historyRowsFor("hist_fail");

		assertThat(send(browser, postJson(base, "/api/v1/search/text",
				"{\"schema_version\":\"1.0.0\",\"k\":5}", csrf)).statusCode()).isEqualTo(400);
		assertThat(historyRowsFor("hist_fail")).isEqualTo(before);
	}

	static HttpRequest delete(URI base, String path, String csrf) {
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path)).DELETE();
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	static HttpRequest postMultipart(URI base, String path, byte[] image, String filename,
			String contentType, String modificationText, String csrf) {
		String boundary = "----fasearch-test-" + java.util.UUID.randomUUID().toString().replace("-", "");
		var parts = new java.io.ByteArrayOutputStream();
		try {
			if (path.endsWith("/composed")) {
				writePart(parts, boundary, "schema_version", "1.0.0");
				if (modificationText != null) {
					writePart(parts, boundary, "modification_text", modificationText);
				}
				writePart(parts, boundary, "k", "5");
			}
			// Image search takes k as a URL query parameter (?k=5 below); nothing
				// is written into the multipart body for it.
			parts.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"image\"; "
					+ "filename=\"" + filename + "\"\r\nContent-Type: " + contentType + "\r\n\r\n")
					.getBytes(java.nio.charset.StandardCharsets.UTF_8));
			parts.write(image);
			parts.write(("\r\n--" + boundary + "--\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
		}
		catch (java.io.IOException impossible) {
			throw new IllegalStateException(impossible);
		}
		String target = path.endsWith("/composed") ? path
				: path + (path.contains("?") ? "&" : "?") + "k=5";
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(target))
				.header("Content-Type", "multipart/form-data; boundary=" + boundary)
				.POST(HttpRequest.BodyPublishers.ofByteArray(parts.toByteArray()));
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	static void writePart(java.io.ByteArrayOutputStream parts, String boundary, String name, String value)
			throws java.io.IOException {
		parts.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name
					+ "\"\r\n\r\n" + value + "\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
	}

	@Test
	void historySupportsFilterDeleteClearAndOptOutKeepsExisting() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		CookieManager otherCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient other = HttpClient.newBuilder().cookieHandler(otherCookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "hist_curator", "hist_curator@example.test");
		register(other, base, "hist_stranger", "hist_stranger@example.test");
		String csrf = login(browser, base, "hist_curator");
		String otherCsrf = login(other, base, "hist_stranger");
		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":true}", csrf)).statusCode())
				.isEqualTo(200);

		byte[] png = java.nio.file.Files.readAllBytes(
				java.nio.file.Path.of("src/test/resources/library-fixture.png"));
		assertThat(send(browser, postJson(base, "/api/v1/search/text",
				"{\"schema_version\":\"1.0.0\",\"query_text\":\"áo đỏ\",\"k\":5}", csrf)).statusCode())
				.isEqualTo(200);
		assertThat(send(browser, postMultipart(base, "/api/v1/search/image",
				png, "query.png", "image/png", null, csrf)).statusCode()).isEqualTo(200);
		assertThat(historyRowsFor("hist_curator")).isEqualTo(2);

		// Filter by mode; unknown mode is rejected.
		HttpResponse<String> textOnly = send(browser,
				get(base, "/api/v1/me/search-history?mode=TEXT"));
		assertThat(textOnly.statusCode()).isEqualTo(200);
		assertThat(json.readTree(textOnly.body()).get("total").asInt()).isEqualTo(1);
		assertThat(json.readTree(textOnly.body()).get("items").get(0).get("mode").asText())
				.isEqualTo("TEXT");
		assertThat(json.readTree(textOnly.body()).get("items").get(0).get("query_text").asText())
				.isEqualTo("áo đỏ");
		assertThat(send(browser, get(base, "/api/v1/me/search-history?mode=VIDEO")).statusCode())
				.isEqualTo(400);

		// Delete one entry; foreign-owner and missing ids are a generic 404.
		String entryId = json.readTree(textOnly.body()).get("items").get(0).get("id").asText();
		assertThat(send(other, delete(base, "/api/v1/me/search-history/" + entryId, otherCsrf))
				.statusCode()).isEqualTo(404);
		assertThat(send(browser, delete(base,
				"/api/v1/me/search-history/00000000-0000-0000-0000-000000000000", csrf))
				.statusCode()).isEqualTo(404);
		assertThat(send(browser, delete(base, "/api/v1/me/search-history/" + entryId, csrf))
				.statusCode()).isEqualTo(204);
		assertThat(historyRowsFor("hist_curator")).isEqualTo(1);

		// Opting out stops future capture but keeps existing entries.
		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":false}", csrf)).statusCode())
				.isEqualTo(200);
		assertThat(send(browser, postJson(base, "/api/v1/search/text",
				"{\"schema_version\":\"1.0.0\",\"query_text\":\"áo đỏ\",\"k\":5}", csrf)).statusCode())
				.isEqualTo(200);
		assertThat(historyRowsFor("hist_curator")).isEqualTo(1);

		// Clear-all deletes owned entries only and retains the (now false) setting.
		assertThat(send(browser, delete(base, "/api/v1/me/search-history", csrf)).statusCode())
				.isEqualTo(204);
		assertThat(historyRowsFor("hist_curator")).isEqualTo(0);
		assertThat(json.readTree(send(browser, get(base, "/api/v1/me/library-preferences")).body())
				.get("record_history").asBoolean()).isFalse();
	}

	@Test
	void preferencesRejectUnknownAndMistypedFields() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "hist_picky", "hist_picky@example.test");
		String csrf = login(browser, base, "hist_picky");

		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":\"yes\"}", csrf))
				.statusCode()).isEqualTo(400);
		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":true,\"account_id\":\"x\"}", csrf))
				.statusCode()).isEqualTo(400);
		// Setting unchanged by rejected writes.
		assertThat(json.readTree(send(browser, get(base, "/api/v1/me/library-preferences")).body())
				.get("record_history").asBoolean()).isFalse();
	}

	@Test
	void historyRetentionCapsAt200AndPurgesAfter30Days() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "hist_capped", "hist_capped@example.test");
		String csrf = login(browser, base, "hist_capped");
		assertThat(send(browser, patchJson(base,
				"/api/v1/me/library-preferences", "{\"record_history\":true}", csrf)).statusCode())
				.isEqualTo(200);

		for (int i = 0; i < 205; i++) {
			HttpResponse<String> search = send(browser, postJson(base, "/api/v1/search/text",
					"{\"schema_version\":\"1.0.0\",\"query_text\":\"váy hoa\",\"k\":5}", csrf));
			assertThat(search.statusCode()).isEqualTo(200);
		}
		assertThat(historyRowsFor("hist_capped")).isEqualTo(200);
		// Deterministic newest-first order is stable across repeated reads.
		String first = send(browser, get(base, "/api/v1/me/search-history?size=100")).body();
		String second = send(browser, get(base, "/api/v1/me/search-history?size=100")).body();
		assertThat(second).isEqualTo(first);
		assertThat(json.readTree(first).get("total").asInt()).isEqualTo(200);

		// A 31-day-old entry is physically purged and stops being returned.
		jdbc.update("UPDATE search_history SET created_at = CURRENT_TIMESTAMP - INTERVAL '31 days' "
					+ "WHERE id = (SELECT h.id FROM search_history h "
					+ "JOIN user_accounts u ON u.id = h.account_id "
					+ "WHERE LOWER(u.username) = 'hist_capped' ORDER BY h.created_at DESC, h.id DESC "
					+ "LIMIT 1 OFFSET 199)");
		library.purgeExpired();
		assertThat(historyRowsFor("hist_capped")).isEqualTo(199);
	}

	int historyRows() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM search_history", Integer.class);
	}

	int historyRowsFor(String username) {
		return jdbc.queryForObject(
				"SELECT COUNT(*) FROM search_history h JOIN user_accounts u ON u.id = h.account_id "
						+ "WHERE LOWER(u.username) = ?",
				Integer.class, username.toLowerCase(java.util.Locale.ROOT));
	}

	static HttpRequest get(URI base, String path) {
		return HttpRequest.newBuilder(base.resolve(path)).GET().build();
	}

	static HttpRequest postJson(URI base, String path, String payload, String csrf) {
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path))
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(payload));
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	static HttpRequest patchJson(URI base, String path, String payload, String csrf) {
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path))
				.header("Content-Type", "application/json")
				.method("PATCH", HttpRequest.BodyPublishers.ofString(payload));
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	static HttpResponse<String> send(HttpClient browser, HttpRequest request) throws Exception {
		return browser.send(request, HttpResponse.BodyHandlers.ofString());
	}

	void register(HttpClient browser, URI base, String username, String email) throws Exception {
		String csrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		HttpResponse<String> registered = send(browser, HttpRequest.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(
						"{\"username\":\"" + username + "\",\"email\":\"" + email + "\","
								+ "\"password\":\"a-very-long-test-passphrase-01\",\"display_name\":null}"))
				.build());
		assertThat(registered.statusCode()).isEqualTo(201);
	}

	String login(HttpClient browser, URI base, String username) throws Exception {
		String csrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		HttpResponse<String> logged = send(browser, HttpRequest.newBuilder(base.resolve("/api/v1/auth/login"))
				.header("Content-Type", "application/x-www-form-urlencoded")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(
						"username=" + username + "&password=a-very-long-test-passphrase-01"))
				.build());
		assertThat(logged.statusCode()).isEqualTo(200);
		return json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
	}
}
