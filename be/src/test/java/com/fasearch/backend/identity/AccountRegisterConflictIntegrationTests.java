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
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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

// S2 tracer: case-insensitive + concurrent duplicates 409 generic, atomic, default role only.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class AccountRegisterConflictIntegrationTests {

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
	void caseInsensitiveDuplicatesAreRejectedWithoutDisclosure() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		assertThat(register(base, "Dup_User", "dup_user@example.test")).isEqualTo(201);
		// Same username different case, same email different case, both 409 generic.
		assertThat(register(base, "dup_USER", "other@example.test")).isEqualTo(409);
		assertThat(register(base, "another_user", "DUP_USER@EXAMPLE.TEST")).isEqualTo(409);
		HttpResponse<String> conflict = registerRaw(base, "dup_USER", "other@example.test");
		assertThat(conflict.statusCode()).isEqualTo(409);
		assertThat(json.readTree(conflict.body()).get("code").asText())
				.isEqualTo("ACCOUNT_CONFLICT");
		assertThat(conflict.body()).doesNotContain("dup_USER", "other@example");
		// Only one account row, one role row (no split/orphan), default role only.
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM user_accounts WHERE LOWER(username) = 'dup_user'",
				Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM user_roles ur JOIN user_accounts u ON u.id = ur.user_id "
						+ "WHERE LOWER(u.username) = 'dup_user'",
				Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM user_roles ur JOIN user_accounts u ON u.id = ur.user_id "
						+ "JOIN roles r ON r.id = ur.role_id "
						+ "WHERE LOWER(u.username) = 'dup_user' AND r.code = 'REGISTERED_USER'",
				Integer.class)).isEqualTo(1);
	}

	@Test
	void concurrentDuplicateCreatesExactlyOneAccount() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		var pool = Executors.newFixedThreadPool(2);
		try {
			List<Callable<Integer>> tasks = new ArrayList<>();
			for (int i = 0; i < 2; i++) {
				tasks.add(() -> register(base, "Race_User", "race_user@example.test"));
			}
			List<Future<Integer>> results = pool.invokeAll(tasks);
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> result : results) {
				statuses.add(result.get());
			}
			assertThat(statuses).containsExactlyInAnyOrder(201, 409);
			assertThat(jdbc.queryForObject(
					"SELECT COUNT(*) FROM user_accounts WHERE LOWER(username) = 'race_user'",
					Integer.class)).isEqualTo(1);
		}
		finally {
			pool.shutdownNow();
		}
	}

	private int register(URI base, String username, String email) throws Exception {
		return registerRaw(base, username, email).statusCode();
	}

	private HttpResponse<String> registerRaw(URI base, String username, String email) throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		String csrf = json.readTree(browser.send(HttpRequest.newBuilder(
				base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		String payload = "{\"username\":\"" + username + "\",\"email\":\"" + email
				+ "\",\"password\":\"a-very-long-test-passphrase-01\"}";
		return browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(payload)).build(),
				HttpResponse.BodyHandlers.ofString());
	}
}
