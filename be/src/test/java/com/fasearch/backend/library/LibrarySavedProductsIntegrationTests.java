package com.fasearch.backend.library;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;

import tools.jackson.databind.json.JsonMapper;

// Personal library RED→GREEN: Saved Products behind /api/v1/me (owner-scoped,
// CSRF-protected, idempotent). First behavior: anonymous mutation is 401.
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
class LibrarySavedProductsIntegrationTests {

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
	void anonymousSaveWithoutCsrfTokenIsForbidden() throws Exception {
		HttpClient anonymous = HttpClient.newHttpClient();
		URI base = URI.create("http://127.0.0.1:" + port);

		HttpResponse<String> response = send(anonymous, put(base, "/api/v1/me/saved-products/p1", null));

		assertThat(response.statusCode()).isEqualTo(403);
	}

	@Test
	void anonymousSaveWithValidTokenIsUnauthorized() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient anonymous = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		String csrf = json.readTree(send(anonymous, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();

		HttpResponse<String> response = send(anonymous, put(base, "/api/v1/me/saved-products/p1", csrf));

		assertThat(response.statusCode()).isEqualTo(401);
		assertThat(json.readTree(response.body()).get("code").asText()).isEqualTo("UNAUTHENTICATED");
	}

	@Test
	void idempotentSaveKeepsOneRowWithStableTimestamp() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "lib_saver", "lib_saver@example.test");
		String csrf = login(browser, base, "lib_saver");

		assertThat(send(browser, put(base, "/api/v1/me/saved-products/p1", csrf)).statusCode())
				.isEqualTo(204);
		String firstSavedAt = jdbc.queryForObject(
				"SELECT saved_at::text FROM saved_products s JOIN user_accounts u ON u.id = s.account_id "
						+ "WHERE LOWER(u.username) = 'lib_saver' AND s.product_id = 'p1'",
				String.class);
		assertThat(send(browser, put(base, "/api/v1/me/saved-products/p1", csrf)).statusCode())
				.isEqualTo(204);

		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM saved_products s JOIN user_accounts u ON u.id = s.account_id "
						+ "WHERE LOWER(u.username) = 'lib_saver'",
				Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject(
				"SELECT saved_at::text FROM saved_products s JOIN user_accounts u ON u.id = s.account_id "
						+ "WHERE LOWER(u.username) = 'lib_saver' AND s.product_id = 'p1'",
				String.class)).isEqualTo(firstSavedAt);
	}

	@Test
	void saveUnknownProductIsNotFound() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "lib_looker", "lib_looker@example.test");
		String csrf = login(browser, base, "lib_looker");

		HttpResponse<String> response = send(browser, put(base, "/api/v1/me/saved-products/nope", csrf));

		assertThat(response.statusCode()).isEqualTo(404);
		assertThat(json.readTree(response.body()).get("code").asText()).isEqualTo("PRODUCT_NOT_FOUND");
	}

	@Test
	void saveMalformedProductIdIsRejected() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "lib_strict", "lib_strict@example.test");
		String csrf = login(browser, base, "lib_strict");

		HttpResponse<String> response = send(browser,
					put(base, "/api/v1/me/saved-products/%2E%2E%2Fetc", csrf));

		assertThat(response.statusCode()).isEqualTo(400);
	}

	@Test
	void removeIsIdempotentAndListShowsOwnNewestFirst() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "lib_owner", "lib_owner@example.test");
		String csrf = login(browser, base, "lib_owner");

		assertThat(send(browser, put(base, "/api/v1/me/saved-products/p1", csrf)).statusCode()).isEqualTo(204);
		assertThat(send(browser, put(base, "/api/v1/me/saved-products/p2", csrf)).statusCode()).isEqualTo(204);
		assertThat(send(browser, delete(base, "/api/v1/me/saved-products/p1", csrf)).statusCode()).isEqualTo(204);
		assertThat(send(browser, delete(base, "/api/v1/me/saved-products/p1", csrf)).statusCode()).isEqualTo(204);

		HttpResponse<String> listed = send(browser, get(base, "/api/v1/me/saved-products?page=1&size=20"));
		assertThat(listed.statusCode()).isEqualTo(200);
		assertThat(json.readTree(listed.body()).get("total").asInt()).isEqualTo(1);
		assertThat(json.readTree(listed.body()).get("items").get(0).get("product_id").asText())
				.isEqualTo("p2");
		assertThat(json.readTree(listed.body()).get("items").get(0).get("available").asBoolean())
				.isTrue();
		assertThat(json.readTree(listed.body()).get("items").get(0).get("product").get("title").asText())
				.isEqualTo("Quần xanh");
	}

	@Test
	void savedProductsAreIsolatedAcrossAccounts() throws Exception {
		CookieManager cookiesA = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browserA = HttpClient.newBuilder().cookieHandler(cookiesA).build();
		CookieManager cookiesB = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browserB = HttpClient.newBuilder().cookieHandler(cookiesB).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browserA, base, "lib_alice", "lib_alice@example.test");
		register(browserB, base, "lib_bob", "lib_bob@example.test");
		String csrfA = login(browserA, base, "lib_alice");
		String csrfB = login(browserB, base, "lib_bob");

		assertThat(send(browserA, put(base, "/api/v1/me/saved-products/p3", csrfA)).statusCode())
				.isEqualTo(204);
		// Bob sees an empty library and cannot remove Alice's entry by product id:
		// his own DELETE is a scoped no-op, Alice's row stays intact.
		assertThat(json.readTree(send(browserB, get(base, "/api/v1/me/saved-products")).body())
				.get("total").asInt()).isEqualTo(0);
		assertThat(send(browserB, delete(base, "/api/v1/me/saved-products/p3", csrfB)).statusCode())
				.isEqualTo(204);
		assertThat(json.readTree(send(browserA, get(base, "/api/v1/me/saved-products")).body())
				.get("total").asInt()).isEqualTo(1);
	}

	@Test
	void concurrentSavesCollapseToOneRow() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "lib_racer", "lib_racer@example.test");
		String csrf = login(browser, base, "lib_racer");
		String session = cookies.getCookieStore().get(base).stream()
				.filter(cookie -> cookie.getName().equals("FASEARCH_SESSION"))
				.map(cookie -> "FASEARCH_SESSION=" + cookie.getValue())
				.findFirst().orElseThrow();

		int writers = 8;
	 var pool = java.util.concurrent.Executors.newFixedThreadPool(writers);
		var ready = new java.util.concurrent.CountDownLatch(writers);
		var done = new java.util.concurrent.CountDownLatch(writers);
		var statuses = new java.util.concurrent.ConcurrentLinkedQueue<Integer>();
		for (int i = 0; i < writers; i++) {
			pool.submit(() -> {
				ready.countDown();
			try {
					ready.await();
				HttpResponse<String> response = HttpClient.newHttpClient().send(
							HttpRequest.newBuilder(base.resolve("/api/v1/me/saved-products/p4"))
								.header("Cookie", session)
								.header("X-CSRF-TOKEN", csrf)
								.PUT(HttpRequest.BodyPublishers.noBody())
								.build(),
						HttpResponse.BodyHandlers.ofString());
					statuses.add(response.statusCode());
				}
				catch (Exception failure) {
					statuses.add(500);
				}
				finally {
					done.countDown();
				}
				return null;
		});
		}
		assertThat(done.await(60, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
		pool.shutdownNow();

		assertThat(statuses).hasSize(writers).allMatch(status -> status == 204);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM saved_products s JOIN user_accounts u ON u.id = s.account_id "
						+ "WHERE LOWER(u.username) = 'lib_racer' AND s.product_id = 'p4'",
				Integer.class)).isEqualTo(1);
	}

	@Test
	void savedListPaginationIsStableAcrossReads() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		register(browser, base, "lib_pager", "lib_pager@example.test");
		String csrf = login(browser, base, "lib_pager");
		for (String product : new String[] { "p1", "p2", "p3", "p4", "p5" }) {
			assertThat(send(browser, put(base, "/api/v1/me/saved-products/" + product, csrf)).statusCode())
					.isEqualTo(204);
		}

		 java.util.List<String> first = ids(send(browser, get(base, "/api/v1/me/saved-products?page=1&size=2")));
		 java.util.List<String> second = ids(send(browser, get(base, "/api/v1/me/saved-products?page=2&size=2")));
		 java.util.List<String> third = ids(send(browser, get(base, "/api/v1/me/saved-products?page=3&size=2")));
		assertThat(first).hasSize(2);
		assertThat(second).hasSize(2);
		assertThat(third).hasSize(1);
		 java.util.List<String> again = ids(send(browser, get(base, "/api/v1/me/saved-products?page=1&size=2")));
		assertThat(again).isEqualTo(first);
		 java.util.Set<String> union = new java.util.HashSet<>();
		union.addAll(first);
		union.addAll(second);
		union.addAll(third);
		assertThat(union).containsExactlyInAnyOrder("p1", "p2", "p3", "p4", "p5");
	}

	 java.util.List<String> ids(HttpResponse<String> listed) throws Exception {
		assertThat(listed.statusCode()).isEqualTo(200);
		 java.util.List<String> ids = new java.util.ArrayList<>();
		for (var item : json.readTree(listed.body()).get("items")) {
			ids.add(item.get("product_id").asText());
		}
		return ids;
	}

	static HttpRequest delete(URI base, String path, String csrf) {
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path)).DELETE();
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	static HttpRequest get(URI base, String path) {
		return HttpRequest.newBuilder(base.resolve(path)).GET().build();
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

	static HttpRequest put(URI base, String path, String csrf) {
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path))
				.PUT(HttpRequest.BodyPublishers.noBody());
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	static HttpResponse<String> send(HttpClient browser, HttpRequest request) throws Exception {
		return browser.send(request, HttpResponse.BodyHandlers.ofString());
	}
}
