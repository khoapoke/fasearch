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

// S4 tracer: own profile PATCH display_name only; protected/unknown rejected; no cross-user.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class AccountProfileIntegrationTests {

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
	void displayNameUpdatePersistsAndProtectedFieldsRejected() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		Session user = login(base, "profile_user", "profile_user@example.test");
		Session other = login(base, "profile_other", "profile_other@example.test");

		// Initial profile readable, username/email present.
		HttpResponse<String> initial = user.get("/api/v1/auth/profile");
		assertThat(initial.statusCode()).isEqualTo(200);
		assertThat(json.readTree(initial.body()).get("username").asText())
				.isEqualTo("profile_user");

		// Valid display_name update persists.
		assertThat(user.patch("/api/v1/auth/profile",
				"{\"display_name\":\"Tên Mới Có Dấu\"}").statusCode()).isEqualTo(200);
		assertThat(json.readTree(user.get("/api/v1/auth/profile").body())
				.get("display_name").asText()).isEqualTo("Tên Mới Có Dấu");

		// Protected + unknown fields rejected, not ignored.
		assertThat(user.patch("/api/v1/auth/profile",
				"{\"display_name\":\"Hợp Lệ\",\"username\":\"hacker\"}").statusCode())
				.isEqualTo(400);
		assertThat(user.patch("/api/v1/auth/profile",
				"{\"display_name\":\"Hợp Lệ\",\"email\":\"hacker@example.test\"}").statusCode())
				.isEqualTo(400);
		assertThat(user.patch("/api/v1/auth/profile",
				"{\"display_name\":\"Hợp Lệ\",\"role\":\"ADMINISTRATOR\"}").statusCode())
				.isEqualTo(400);
		assertThat(user.patch("/api/v1/auth/profile", "{\"nickname\":\"x\"}").statusCode())
				.isEqualTo(400);
		// Failed attempts did not change the settled value.
		assertThat(json.readTree(user.get("/api/v1/auth/profile").body())
				.get("display_name").asText()).isEqualTo("Tên Mới Có Dấu");

		// Wrong content type with a valid session + CSRF is 415 (no 401/403 mask),
		// no-store, and does not touch the settled profile.
		{
			String csrf = json.readTree(user.browser().send(HttpRequest.newBuilder(
					base.resolve("/api/v1/auth/csrf")).GET().build(),
					HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
			HttpResponse<String> unsupported = user.browser().send(HttpRequest
					.newBuilder(base.resolve("/api/v1/auth/profile"))
					.header("Content-Type", "text/plain")
					.header("X-CSRF-TOKEN", csrf)
					.method("PATCH", HttpRequest.BodyPublishers.ofString("hello")).build(),
					HttpResponse.BodyHandlers.ofString());
			assertThat(unsupported.statusCode()).isEqualTo(415);
			assertThat(unsupported.headers().firstValue("cache-control")).hasValue("no-store");
			assertThat(json.readTree(unsupported.body()).get("code").asText())
					.isEqualTo("UNSUPPORTED_MEDIA_TYPE");
			assertThat(json.readTree(user.get("/api/v1/auth/profile").body())
					.get("display_name").asText()).isEqualTo("Tên Mới Có Dấu");
		}
		// Second user unaffected; anonymous PATCH without CSRF is 403 (CSRF first),
		// anonymous PATCH with a valid token but no login is 401.
		assertThat(json.readTree(other.get("/api/v1/auth/profile").body())
				.get("username").asText()).isEqualTo("profile_other");
		HttpResponse<String> anonymousPatch = HttpClient.newHttpClient().send(HttpRequest.newBuilder(
					base.resolve("/api/v1/auth/profile"))
				.header("Content-Type", "application/json")
				.method("PATCH", HttpRequest.BodyPublishers.ofString(
						"{\"display_name\":\"Anon\"}"))
				.build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(anonymousPatch.statusCode()).isEqualTo(403);
		CookieManager anonCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient anon = HttpClient.newBuilder().cookieHandler(anonCookies).build();
		String anonCsrf = json.readTree(anon.send(HttpRequest.newBuilder(
					base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		HttpResponse<String> unauthenticatedPatch = anon.send(HttpRequest.newBuilder(
					base.resolve("/api/v1/auth/profile"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", anonCsrf)
				.method("PATCH", HttpRequest.BodyPublishers.ofString(
						"{\"display_name\":\"Anon\"}"))
				.build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(unauthenticatedPatch.statusCode()).isEqualTo(401);
	}

	private Session login(URI base, String username, String email) throws Exception {
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		String csrf = json.readTree(browser.send(HttpRequest.newBuilder(
				base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		String payload = "{\"username\":\"" + username + "\",\"email\":\"" + email
				+ "\",\"password\":\"a-very-long-test-passphrase-01\"}";
		HttpResponse<String> registered = browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/register"))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(payload)).build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(registered.statusCode()).isIn(201, 409);
		String loginCsrf = json.readTree(browser.send(HttpRequest.newBuilder(
				base.resolve("/api/v1/auth/csrf")).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
		HttpResponse<String> login = browser.send(HttpRequest
				.newBuilder(base.resolve("/api/v1/auth/login"))
				.header("Content-Type", "application/x-www-form-urlencoded")
				.header("X-CSRF-TOKEN", loginCsrf)
				.POST(HttpRequest.BodyPublishers.ofString(
						"username=" + username + "&password=a-very-long-test-passphrase-01"))
				.build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(login.statusCode()).isEqualTo(200);
		return new Session(base, browser, json);
	}

	private record Session(URI base, HttpClient browser, JsonMapper json) {
		HttpResponse<String> get(String path) throws Exception {
			return browser.send(HttpRequest.newBuilder(base.resolve(path)).GET().build(),
					HttpResponse.BodyHandlers.ofString());
		}

		HttpResponse<String> patch(String path, String payload) throws Exception {
			String csrf = json.readTree(browser.send(HttpRequest.newBuilder(
					base.resolve("/api/v1/auth/csrf")).GET().build(),
					HttpResponse.BodyHandlers.ofString()).body()).get("token").asText();
			return browser.send(HttpRequest.newBuilder(base.resolve(path))
					.header("Content-Type", "application/json")
					.header("X-CSRF-TOKEN", csrf)
					.method("PATCH", HttpRequest.BodyPublishers.ofString(payload)).build(),
					HttpResponse.BodyHandlers.ofString());
		}
	}
}
