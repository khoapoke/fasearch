package com.fasearch.backend.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class SessionSecurityIntegrationTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer database = new PostgreSQLContainer("postgres:16-alpine");

	@org.springframework.beans.factory.annotation.Value("${local.server.port}")
	int port;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	PasswordEncoder passwords;

	@Autowired
	JsonMapper json;

	@Autowired
	BootstrapAdministrator bootstrap;

	@Test
	@Transactional
	void lockedBootstrapAdministratorIsNotRecreatedOnRestart() {
		UUID administratorId = jdbc.queryForObject(
				"SELECT user_id FROM user_roles WHERE role_id = ?",
				UUID.class,
				UUID.fromString("00000000-0000-0000-0000-000000000104"));
		jdbc.update("UPDATE user_accounts SET status = 'LOCKED' WHERE id = ?", administratorId);

		bootstrap.run(new DefaultApplicationArguments(new String[0]));

		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM user_roles WHERE role_id = ?",
				Integer.class,
				UUID.fromString("00000000-0000-0000-0000-000000000104")))
				.isEqualTo(1);
	}

	@Test
	void publicImageSearchDoesNotRequireSessionOrCsrf() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		HttpRequest request = HttpRequest.newBuilder(base.resolve("/api/v1/search/image"))
				.header("Content-Type", "multipart/form-data; boundary=empty-image")
				.POST(HttpRequest.BodyPublishers.ofString("--empty-image--\r\n"))
				.build();

		HttpResponse<String> response = send(HttpClient.newHttpClient(), request);
		assertThat(response.statusCode()).isEqualTo(400);
		assertThat(json.readTree(response.body()).get("code").asText()).isEqualTo("INVALID_REQUEST");
		assertThat(response.headers().allValues("set-cookie")).isEmpty();
	}

	@Test
	void csrfSessionLoginPermissionsAndLogoutWorkAcrossRealHttpRequests() throws Exception {
		insertUser("registered-test", "REGISTERED_USER");
		insertUser("staff-test", "OPERATIONS_STAFF");
		insertUser("staff-other", "OPERATIONS_STAFF");
		insertUser("locked-test", "OPERATIONS_STAFF");
		jdbc.update("UPDATE user_accounts SET status = 'LOCKED' WHERE username = 'locked-test'");
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		URI base = URI.create("http://127.0.0.1:" + port);

		assertThat(send(browser, get(base, "/api/v1/auth/me")).statusCode()).isEqualTo(401);
		HttpResponse<String> csrfResponse = send(browser, get(base, "/api/v1/auth/csrf"));
		assertThat(csrfResponse.statusCode()).isEqualTo(200);
		String anonymousSessionId = sessionId(cookies);
		assertThat(anonymousSessionId).isNotBlank();
		assertThat(csrfResponse.headers().allValues("set-cookie"))
				.anySatisfy(cookie -> {
					assertThat(cookie).contains("HttpOnly");
					assertThat(cookie).contains("SameSite=Lax");
				});
		String csrf = json.readTree(csrfResponse.body()).get("token").asText();

		HttpResponse<String> missingCsrf = send(browser, postForm(base, "/api/v1/auth/login",
				"username=registered-test&password=Test-only-User-Passphrase-123", null));
		assertThat(missingCsrf.statusCode()).isEqualTo(403);

		HttpResponse<String> login = send(browser, postForm(base, "/api/v1/auth/login",
				"username=registered-test&password=Test-only-User-Passphrase-123", csrf));
		assertThat(login.statusCode()).isEqualTo(200);
		assertThat(json.readTree(login.body()).get("authenticated").asBoolean()).isTrue();
		assertThat(login.body()).doesNotContain("access_token", "refresh_token");
		assertThat(sessionId(cookies)).isNotEqualTo(anonymousSessionId);

		HttpResponse<String> me = send(browser, get(base, "/api/v1/auth/me"));
		assertThat(me.statusCode()).isEqualTo(200);
		assertThat(json.readTree(me.body()).get("username").asText()).isEqualTo("registered-test");
		assertThat(send(browser, get(base, "/api/v1/catalog/admin/drafts/probe")).statusCode())
				.isEqualTo(403);

		String refreshedCsrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		assertThat(send(browser, postJson(base, "/api/v1/catalog/admin/drafts",
				"{\"title\":\"Áo xanh\",\"category\":\"TOP\"}", refreshedCsrf)).statusCode())
				.isEqualTo(403);
		HttpResponse<String> logout = send(browser, postForm(base, "/api/v1/auth/logout", "", refreshedCsrf));
		assertThat(logout.statusCode()).isEqualTo(204);
		assertThat(send(browser, get(base, "/api/v1/auth/me")).statusCode()).isEqualTo(401);

		CookieManager staffCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient staffBrowser = HttpClient.newBuilder().cookieHandler(staffCookies).build();
		String staffCsrf = json.readTree(send(staffBrowser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		assertThat(send(staffBrowser, postForm(base, "/api/v1/auth/login",
				"username=staff-test&password=Test-only-User-Passphrase-123", staffCsrf)).statusCode())
				.isEqualTo(200);
		String staffProfile = send(staffBrowser, get(base, "/api/v1/auth/me")).body();
		assertThat(staffProfile).contains("CATALOG_DRAFT_WRITE");
		assertThat(staffProfile).doesNotContain("CATALOG_PUBLISH");
		String staffFreshCsrf = json.readTree(send(staffBrowser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		HttpResponse<String> created = send(staffBrowser, postJson(base,
				"/api/v1/catalog/admin/drafts",
				"{\"title\":\"Áo xanh\",\"description\":\"Cotton\",\"category\":\"TOP\"}",
				staffFreshCsrf));
		assertThat(created.statusCode()).isEqualTo(201);
		JsonNode draft = json.readTree(created.body());
		assertThat(draft.get("status").asText()).isEqualTo("DRAFT");
		assertThat(draft.get("version_no").asInt()).isEqualTo(1);
		assertThat(draft.get("product_id").asText()).isNotBlank();
		assertThat(send(staffBrowser, get(base, created.headers().firstValue("location").orElseThrow()))
				.statusCode()).isEqualTo(200);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM audit_events WHERE action = 'CATALOG_DRAFT_CREATED'",
				Integer.class)).isEqualTo(1);
		String draftPath = created.headers().firstValue("location").orElseThrow();
		HttpResponse<String> revised = send(staffBrowser, patchJson(base, draftPath,
				"{\"title\":\"Áo xanh đậm\",\"description\":\"Cotton\",\"category\":\"TOP\",\"expected_version_no\":1}",
				staffFreshCsrf));
		assertThat(revised.statusCode()).isEqualTo(200);
		assertThat(json.readTree(revised.body()).get("version_no").asInt()).isEqualTo(2);
		assertThat(send(staffBrowser, patchJson(base, draftPath,
				"{\"title\":\"Bản cũ\",\"category\":\"TOP\",\"expected_version_no\":1}",
				staffFreshCsrf)).statusCode()).isEqualTo(409);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM product_versions WHERE product_id = ?",
				Integer.class, UUID.fromString(draft.get("product_id").asText()))).isEqualTo(2);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM audit_events WHERE action = 'CATALOG_DRAFT_REVISED'",
				Integer.class)).isEqualTo(1);
		assertThat(send(staffBrowser, postJson(base, "/api/v1/catalog/admin/drafts",
				"{\"title\":\"Sai danh mục\",\"category\":\"FOOTWEAR\"}", staffFreshCsrf)).statusCode())
				.isEqualTo(400);
		assertThat(send(staffBrowser, get(base, "/api/v1/catalog/admin/publications/probe")).statusCode())
				.isEqualTo(403);

		CookieManager otherCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient otherStaff = HttpClient.newBuilder().cookieHandler(otherCookies).build();
		String otherCsrf = json.readTree(send(otherStaff, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		assertThat(send(otherStaff, postForm(base, "/api/v1/auth/login",
				"username=staff-other&password=Test-only-User-Passphrase-123", otherCsrf)).statusCode())
				.isEqualTo(200);
		assertThat(send(otherStaff, get(base, draftPath)).statusCode()).isEqualTo(403);

		CookieManager lockedCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient lockedBrowser = HttpClient.newBuilder().cookieHandler(lockedCookies).build();
		String lockedCsrf = json.readTree(send(lockedBrowser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		assertThat(send(lockedBrowser, postForm(base, "/api/v1/auth/login",
				"username=locked-test&password=Test-only-User-Passphrase-123", lockedCsrf)).statusCode())
				.isEqualTo(401);
	}

	private void insertUser(String username, String role) {
		UUID id = UUID.randomUUID();
		jdbc.update("INSERT INTO user_accounts (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
				id, username, username + "@example.test",
				passwords.encode("Test-only-User-Passphrase-123"));
		jdbc.update("INSERT INTO user_roles (user_id, role_id) "
					+ "SELECT ?, id FROM roles WHERE code = ?", id, role);
	}

	private static String sessionId(CookieManager cookies) {
		return cookies.getCookieStore().getCookies().stream()
				.filter(cookie -> cookie.getName().equals("FASEARCH_SESSION"))
				.map(HttpCookie::getValue)
				.findFirst().orElse("");
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

	private static HttpRequest postJson(URI base, String path, String json, String csrf) {
		return HttpRequest.newBuilder(base.resolve(path))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.POST(HttpRequest.BodyPublishers.ofString(json))
				.build();
	}

	private static HttpRequest patchJson(URI base, String path, String json, String csrf) {
		return HttpRequest.newBuilder(base.resolve(path))
				.header("Content-Type", "application/json")
				.header("X-CSRF-TOKEN", csrf)
				.method("PATCH", HttpRequest.BodyPublishers.ofString(json))
				.build();
	}

	private static HttpResponse<String> send(HttpClient browser, HttpRequest request) throws Exception {
		return browser.send(request, HttpResponse.BodyHandlers.ofString());
	}
}
