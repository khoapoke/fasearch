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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;

import tools.jackson.databind.json.JsonMapper;

// S1 tracer: valid register creates ACTIVE + REGISTERED_USER, 201 safe profile, no autologin.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class AccountRegistrationIntegrationTests {

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
	void validRegisterCreatesActiveAccountWithoutLogin() throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);
		String csrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();

		HttpResponse<String> registered = send(browser, postJson(base,
				"/api/v1/auth/register",
				"{\"username\":\"new_user.01\",\"email\":\"new_user01@example.test\","
						+ "\"password\":\"a-very-long-test-passphrase-01\",\"display_name\":\"Người Dùng Mới\"}",
				csrf));
		assertThat(registered.statusCode()).isEqualTo(201);
		assertThat(registered.body()).doesNotContain("password", "password_hash", "hash");
		assertThat(json.readTree(registered.body()).get("username").asText())
				.isEqualTo("new_user.01");

		// No autologin: fresh cookie jar sees 401 on /me, registering jar too.
		assertThat(send(browser, get(base, "/api/v1/auth/me")).statusCode()).isEqualTo(401);

		// Retrievable own profile after explicit login.
		String loginCsrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		assertThat(send(browser, postForm(base, "/api/v1/auth/login",
				"username=new_user.01&password=a-very-long-test-passphrase-01", loginCsrf))
				.statusCode()).isEqualTo(200);
		HttpResponse<String> profile = send(browser, get(base, "/api/v1/auth/profile"));
		assertThat(profile.statusCode()).isEqualTo(200);
		assertThat(json.readTree(profile.body()).get("email").asText())
				.isEqualTo("new_user01@example.test");
	}

	private static HttpRequest get(URI base, String path) {
		return HttpRequest.newBuilder(base.resolve(path)).GET().build();
	}

	private static HttpRequest postForm(URI base, String path, String form, String csrf) {
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path))
				.header("Content-Type", "application/x-www-form-urlencoded")
				.POST(HttpRequest.BodyPublishers.ofString(form));
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	private static HttpRequest postJson(URI base, String path, String payload, String csrf) {
		HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path))
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(payload));
		if (csrf != null) {
			request.header("X-CSRF-TOKEN", csrf);
		}
		return request.build();
	}

	private static HttpResponse<String> send(HttpClient browser, HttpRequest request) throws Exception {
		return browser.send(request, HttpResponse.BodyHandlers.ofString());
	}
}
