package com.fasearch.backend.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
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
class CatalogDraftListIntegrationTests {

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

	@Test
	void anonymousListRequestReturns401() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		HttpResponse<String> response = send(HttpClient.newHttpClient(),
				get(base, "/api/v1/catalog/admin/drafts"));
		assertThat(response.statusCode()).isEqualTo(401);
	}

	@Test
	void registeredUserWithoutPermissionReturns403() throws Exception {
		insertUser("list-registered", "REGISTERED_USER");
		Session session = login("list-registered");
		HttpResponse<String> response = send(session.browser,
				get(session.base, "/api/v1/catalog/admin/drafts"));
		assertThat(response.statusCode()).isEqualTo(403);
	}

	@Test
	void staffSeesOnlyOwnDraftsAndAdminSeesAll() throws Exception {
		insertUser("list-staff-a", "OPERATIONS_STAFF");
		insertUser("list-staff-b", "OPERATIONS_STAFF");
		insertUser("list-admin", "ADMINISTRATOR");
		Session staffA = login("list-staff-a");
		Session staffB = login("list-staff-b");
		Session admin = login("list-admin");

		String pathA = createDraft(staffA, "Áo của A", "TOP");
		String pathB = createDraft(staffB, "Quần của B", "BOTTOM");

		JsonNode listA = json.readTree(listOk(staffA, "").body());
		assertThat(listA.get("limit").asInt()).isEqualTo(20);
		assertThat(listA.get("offset").asInt()).isEqualTo(0);
		assertThat(listA.get("has_more").asBoolean()).isFalse();
		assertThat(listA.get("items").size()).isEqualTo(1);
		assertThat(listA.get("items").get(0).get("title").asText()).isEqualTo("Áo của A");

		JsonNode listB = json.readTree(listOk(staffB, "").body());
		assertThat(listB.get("items").size()).isEqualTo(1);
		assertThat(listB.get("items").get(0).get("title").asText()).isEqualTo("Quần của B");

		JsonNode listAdmin = json.readTree(listOk(admin, "").body());
		assertThat(listAdmin.get("items").size()).isEqualTo(2);

		assertThat(send(staffA.browser, get(staffA.base, pathB)).statusCode()).isEqualTo(403);
		assertThat(send(staffB.browser, get(staffB.base, pathA)).statusCode()).isEqualTo(403);
		assertThat(send(admin.browser, get(admin.base, pathA)).statusCode()).isEqualTo(200);
	}

	@Test
	void onlyLatestDraftVersionPerProductIsListed() throws Exception {
		insertUser("list-revise-staff", "OPERATIONS_STAFF");
		Session staff = login("list-revise-staff");

		String path = createDraft(staff, "Áo sửa nhiều lần", "TOP");
		JsonNode revised = json.readTree(send(staff.browser,
				patchJson(staff.base, path,
						"{\"title\":\"Áo sửa nhiều lần\",\"category\":\"TOP\",\"expected_version_no\":1}",
						staff.csrf)).body());
		assertThat(revised.get("version_no").asInt()).isEqualTo(2);

		JsonNode list = json.readTree(listOk(staff, "").body());
		assertThat(list.get("items").size()).isEqualTo(1);
		JsonNode item = list.get("items").get(0);
		assertThat(item.get("version_no").asInt()).isEqualTo(2);
		assertThat(item.get("status").asText()).isEqualTo("DRAFT");
		assertThat(item.get("has_primary_image").asBoolean()).isFalse();
		assertThat(item.get("product_id").asText()).isNotBlank();
		assertThat(item.get("product_version_id").asText()).isNotBlank();
		assertThat(item.has("description")).isFalse();
		assertThat(item.has("created_by")).isFalse();

		UUID productId = UUID.fromString(item.get("product_id").asText());
		jdbc.update("UPDATE product_versions SET status = 'NEEDS_REVIEW' "
				+ "WHERE product_id = ? AND version_no = 2", productId);
		assertThat(json.readTree(listOk(staff, "").body()).get("items").size()).isEqualTo(0);

		String archivedPath = createDraft(staff, "Áo lưu trữ", "ONE_PIECE");
		JsonNode archived = json.readTree(
				send(staff.browser, get(staff.base, archivedPath)).body());
		jdbc.update("UPDATE catalog_products SET archived_at = CURRENT_TIMESTAMP WHERE id = ?",
				UUID.fromString(archived.get("product_id").asText()));
		JsonNode afterArchive = json.readTree(listOk(staff, "").body());
		assertThat(afterArchive.get("items").size()).isEqualTo(0);
	}

	@Test
	void paginationOrderingAndInvalidParameters() throws Exception {
		insertUser("list-page-staff", "OPERATIONS_STAFF");
		Session staff = login("list-page-staff");

		String oldest = productIdOf(createDraft(staff, "Cũ nhất", "TOP"));
		String middle = productIdOf(createDraft(staff, "Ở giữa", "BOTTOM"));
		String newest = productIdOf(createDraft(staff, "Mới nhất", "ONE_PIECE"));
		jdbc.update("UPDATE product_versions SET created_at = CURRENT_TIMESTAMP - INTERVAL '3 minutes' "
				+ "WHERE product_id = ?", UUID.fromString(oldest));
		jdbc.update("UPDATE product_versions SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes' "
				+ "WHERE product_id = ?", UUID.fromString(middle));
		jdbc.update("UPDATE product_versions SET created_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' "
				+ "WHERE product_id = ?", UUID.fromString(newest));

		JsonNode page1 = json.readTree(listOk(staff, "?limit=2&offset=0").body());
		assertThat(page1.get("limit").asInt()).isEqualTo(2);
		assertThat(page1.get("offset").asInt()).isEqualTo(0);
		assertThat(page1.get("has_more").asBoolean()).isTrue();
		assertThat(page1.get("items").size()).isEqualTo(2);
		assertThat(page1.get("items").get(0).get("title").asText()).isEqualTo("Mới nhất");
		assertThat(page1.get("items").get(1).get("title").asText()).isEqualTo("Ở giữa");

		JsonNode page2 = json.readTree(listOk(staff, "?limit=2&offset=2").body());
		assertThat(page2.get("has_more").asBoolean()).isFalse();
		assertThat(page2.get("items").size()).isEqualTo(1);
		assertThat(page2.get("items").get(0).get("title").asText()).isEqualTo("Cũ nhất");

		for (String invalid : new String[] {
				"?limit=0", "?limit=101", "?limit=abc", "?limit=",
				"?offset=-1", "?offset=xyz", "?offset=" }) {
			HttpResponse<String> response = send(staff.browser,
					get(staff.base, "/api/v1/catalog/admin/drafts" + invalid));
			assertThat(response.statusCode())
					.as("expected 400 for %s", invalid).isEqualTo(400);
			assertThat(json.readTree(response.body()).get("code").asText())
					.isEqualTo("INVALID_REQUEST");
		}
	}

	@Test
	void listingCreatesNoProductVersionOrAuditEvent() throws Exception {
		insertUser("list-readonly-staff", "OPERATIONS_STAFF");
		Session staff = login("list-readonly-staff");
		createDraft(staff, "Áo chỉ đọc", "TOP");

		int versionsBefore = versionCount();
		int auditsBefore = auditCount();
		for (int page = 0; page < 3; page++) {
			assertThat(listOk(staff, "?limit=1&offset=" + page).statusCode()).isEqualTo(200);
		}
		assertThat(versionCount()).isEqualTo(versionsBefore);
		assertThat(auditCount()).isEqualTo(auditsBefore);
	}

	private HttpResponse<String> listOk(Session session, String query) throws Exception {
		HttpResponse<String> response = send(session.browser,
				get(session.base, "/api/v1/catalog/admin/drafts" + query));
		assertThat(response.statusCode()).isEqualTo(200);
		return response;
	}

	private String createDraft(Session session, String title, String category) throws Exception {
		HttpResponse<String> created = send(session.browser, postJson(session.base,
				"/api/v1/catalog/admin/drafts",
				"{\"title\":\"" + title + "\",\"category\":\"" + category + "\"}", session.csrf));
		assertThat(created.statusCode()).isEqualTo(201);
		return created.headers().firstValue("location").orElseThrow();
	}

	private String productIdOf(String locationPath) {
		return locationPath.substring(locationPath.lastIndexOf('/') + 1);
	}

	private int versionCount() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM product_versions", Integer.class);
	}

	private int auditCount() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM audit_events", Integer.class);
	}

	private Session login(String username) throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
		HttpClient browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		String csrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		assertThat(send(browser, postForm(base, "/api/v1/auth/login",
				"username=" + username + "&password=Test-only-User-Passphrase-123", csrf))
				.statusCode()).isEqualTo(200);
		String freshCsrf = json.readTree(send(browser, get(base, "/api/v1/auth/csrf")).body())
				.get("token").asText();
		return new Session(browser, base, freshCsrf);
	}

	private void insertUser(String username, String role) {
		UUID id = UUID.randomUUID();
		jdbc.update("INSERT INTO user_accounts (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
				id, username, username + "@example.test",
				passwords.encode("Test-only-User-Passphrase-123"));
		jdbc.update("INSERT INTO user_roles (user_id, role_id) "
				+ "SELECT ?, id FROM roles WHERE code = ?", id, role);
	}

	private record Session(HttpClient browser, URI base, String csrf) {
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

	@TestConfiguration(proxyBeanMethods = false)
	static class StorageTestConfiguration {
		@Bean
		@Primary
		TestObjectStore testObjectStore() {
			return new TestObjectStore();
		}
	}

	static class TestObjectStore implements CatalogObjectStore {
		final Map<String, byte[]> data = new ConcurrentHashMap<>();

		@Override
		public String put(String key, byte[] bytes, String mediaType) {
			String uri = "s3://fasearch-product-images/" + key;
			data.put(uri, Arrays.copyOf(bytes, bytes.length));
			return uri;
		}

		@Override
		public byte[] read(String storageUri) {
			return data.get(storageUri);
		}

		@Override
		public void delete(String storageUri) {
			data.remove(storageUri);
		}
	}
}
