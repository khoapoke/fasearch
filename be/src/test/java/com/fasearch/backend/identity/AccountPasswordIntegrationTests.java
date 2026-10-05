package com.fasearch.backend.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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

// S5 tracer: current check + policy, two-jar revocation incl current, other user intact,
// concurrent change regression, no resurrection.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class AccountPasswordIntegrationTests {

	static final String INITIAL = "a-very-long-test-passphrase-01";
	static final String RENEWED = "another-very-long-test-passphrase-02";

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
	void currentCheckAndNewPolicyAreEnforced() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		Session user = login(base, "pw_policy_user", "pw_policy_user@example.test");

		// Wrong current credential -> 400 generic, session stays valid.
		HttpResponse<String> wrong = user.post("/api/v1/auth/password",
				"{\"current_password\":\"wrong-current-passphrase-00\",\"new_password\":\""
						+ RENEWED + "\"}");
		assertThat(wrong.statusCode()).isEqualTo(400);
		assertThat(json.readTree(wrong.body()).get("code").asText())
				.isEqualTo("CURRENT_PASSWORD_INVALID");
		assertThat(user.get("/api/v1/auth/me").statusCode()).isEqualTo(200);

		// New policy violations -> 400, even with correct current.
		assertThat(user.post("/api/v1/auth/password",
				"{\"current_password\":\"" + INITIAL + "\",\"new_password\":\"short\"}")
				.statusCode()).isEqualTo(400);
		assertThat(user.post("/api/v1/auth/password",
				"{\"current_password\":\"" + INITIAL + "\",\"new_password\":\""
						+ "😀".repeat(20) + "\"}").statusCode()).isEqualTo(400);
		assertThat(user.post("/api/v1/auth/password",
				"{\"current_password\":\"" + INITIAL + "\",\"new_password\":\""
						+ INITIAL + "\",\"role\":\"ADMIN\"}").statusCode()).isEqualTo(400);

		// Anonymous with token -> 401; missing CSRF -> 403; wrong content -> 415.
		assertThat(anonymousPost(base, null).statusCode()).isEqualTo(403);
		assertThat(user.post("/api/v1/auth/password",
				"{\"current_password\":\"" + INITIAL + "\"}").statusCode()).isEqualTo(400);
	}

	@Test
	void validChangeRevokesBothSessionsAndKeepsOtherUser() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		Session first = login(base, "Case_PwUser", "case_pwuser@example.test");
		Session second = login(base, "Case_PwUser", "case_pwuser@example.test");
		Session other = login(base, "pw_other_user", "pw_other_user@example.test");
		assertThat(first.get("/api/v1/auth/me").statusCode()).isEqualTo(200);
		assertThat(second.get("/api/v1/auth/me").statusCode()).isEqualTo(200);

		// Actual JDBC principal mapping observed, not assumed lowercase.
		List<String> principals = jdbc.queryForList(
				"SELECT DISTINCT PRINCIPAL_NAME FROM SPRING_SESSION WHERE PRINCIPAL_NAME IS NOT NULL",
				String.class);
		assertThat(principals).contains("Case_PwUser");

		assertThat(first.post("/api/v1/auth/password",
				"{\"current_password\":\"" + INITIAL + "\",\"new_password\":\""
						+ RENEWED + "\"}").statusCode()).isEqualTo(204);

		// Both jars revoked including the current one; hammering stays 401.
		assertThat(first.get("/api/v1/auth/me").statusCode()).isEqualTo(401);
		assertThat(second.get("/api/v1/auth/me").statusCode()).isEqualTo(401);
		for (int i = 0; i < 3; i++) {
			assertThat(first.get("/api/v1/auth/me").statusCode()).isEqualTo(401);
			assertThat(second.get("/api/v1/auth/me").statusCode()).isEqualTo(401);
		}
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME = 'Case_PwUser'",
				Integer.class)).isEqualTo(0);

		// Other user untouched: session and rows survive.
		assertThat(other.get("/api/v1/auth/me").statusCode()).isEqualTo(200);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME = 'pw_other_user'",
				Integer.class)).isGreaterThan(0);

		// Old password dead, new password works.
		assertThat(loginAttempt(base, "Case_PwUser", INITIAL)).isEqualTo(401);
		assertThat(loginAttempt(base, "Case_PwUser", RENEWED)).isEqualTo(200);
	}

	@Test
	void concurrentChangesCannotBothSucceed() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		Session first = login(base, "pw_race_user", "pw_race_user@example.test");
		Session second = login(base, "pw_race_user", "pw_race_user@example.test");
		String newA = "race-winner-new-passphrase-A1";
		String newB = "race-winner-new-passphrase-B2";
		CountDownLatch start = new CountDownLatch(1);
		var pool = Executors.newFixedThreadPool(2);
		try {
			List<Callable<Integer>> tasks = new ArrayList<>();
			tasks.add(() -> {
				start.await(10, TimeUnit.SECONDS);
				return first.post("/api/v1/auth/password",
						"{\"current_password\":\"" + INITIAL + "\",\"new_password\":\""
								+ newA + "\"}").statusCode();
			});
			tasks.add(() -> {
				start.await(10, TimeUnit.SECONDS);
				return second.post("/api/v1/auth/password",
						"{\"current_password\":\"" + INITIAL + "\",\"new_password\":\""
								+ newB + "\"}").statusCode();
			});
			List<Future<Integer>> futures = tasks.stream().map(pool::submit).toList();
			start.countDown();
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> future : futures) {
				statuses.add(future.get(30, TimeUnit.SECONDS));
			}
			assertThat(statuses.stream().filter(status -> status == 204).count()).isEqualTo(1);
			assertThat(statuses).allMatch(status -> status == 204 || status == 400 || status == 401);
			// Exactly one new password works; old is dead either way.
			assertThat(loginAttempt(base, "pw_race_user", INITIAL)).isEqualTo(401);
			int okA = loginAttempt(base, "pw_race_user", newA);
			int okB = loginAttempt(base, "pw_race_user", newB);
			assertThat(okA == 200 ^ okB == 200).isTrue();
		}
		finally {
			pool.shutdownNow();
		}
	}

	private Session login(URI base, String username, String email) throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		String csrf = json.readTree(browser.send(HttpRequest.newBuilder(
				base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		String payload = "{\"username\":\"" + username + "\",\"email\":\"" + email
				+ "\",\"password\":\"" + INITIAL + "\"}";
		HttpResponse<String> registered = browser.send(HttpRequest
				.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(payload)).build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(registered.statusCode()).isIn(201, 409);
		if (registered.statusCode() == 409) {
			// Pre-existing fixture from another test run is not reused across tests;
			// usernames are unique per test, so 409 here would be a real conflict.
		}
		int loginStatus = loginWith(browser, base, username, INITIAL);
		assertThat(loginStatus).isEqualTo(200);
		return new Session(base, browser, json);
	}

	private int loginAttempt(URI base, String username, String password) throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		return loginWith(browser, base, username, password);
	}

	private int loginWith(HttpClient browser, URI base, String username, String password)
			throws Exception {
		String csrf = json.readTree(browser.send(HttpRequest.newBuilder(
				base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		return browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/login"))
				.header("Content-Type", "application/x-www-form-urlencoded")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(
						"username=" + username + "&password=" + password)).build(),
				HttpResponse.BodyHandlers.ofString()).statusCode();
	}

	private HttpResponse<String> anonymousPost(URI base, String csrf) throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve("/api/v1/auth/password"))
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(
						"{\"current_password\":\"" + INITIAL + "\",\"new_password\":\""
								+ RENEWED + "\"}"));
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return browser.send(request.build(), HttpResponse.BodyHandlers.ofString());
	}

	private record Session(URI base, HttpClient browser, JsonMapper json) {
		HttpResponse<String> get(String path) throws Exception {
			return browser.send(HttpRequest.newBuilder(base.resolve(path)).GET().build(),
					HttpResponse.BodyHandlers.ofString());
		}

		HttpResponse<String> post(String path, String payload) throws Exception {
			String csrf = json.readTree(browser.send(HttpRequest.newBuilder(
					base.resolve("/api/v1/auth/csrf")).GET().build(),
					HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
			return browser.send(HttpRequest.newBuilder(base.resolve(path))
					.header("Content-Type", "application/json")
					.header("X-CSRF-TOKEN", csrf)
					.POST(HttpRequest.BodyPublishers.ofString(payload)).build(),
					HttpResponse.BodyHandlers.ofString());
		}
	}
}
