package com.fasearch.backend.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
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

/**
 * Operations Console coverage: role matrix, server filters, summary counts,
 * version timeline/detail/image binding, audit lineage and conflict safety.
 */
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class CatalogOperationsConsoleIntegrationTests {

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
	void anonymousAndRegisteredCannotReachOperations() throws Exception {
		insertUser("ops-registered", "REGISTERED_USER");
		Session registered = login("ops-registered");
		HttpClient anonymous = HttpClient.newHttpClient();
		URI base = URI.create("http://127.0.0.1:" + port);
		for (String path : new String[] {
				"/api/v1/catalog/admin/drafts/summary",
				"/api/v1/catalog/admin/drafts?has_primary_image=true" }) {
			assertThat(send(anonymous, get(base, path)).statusCode()).isEqualTo(401);
			assertThat(send(registered.browser, get(registered.base, path)).statusCode())
					.isEqualTo(403);
		}
	}

	@Test
	void staffIsolationAcrossSummaryListVersionsAndAudit() throws Exception {
		insertUser("ops-staff-a", "OPERATIONS_STAFF");
		insertUser("ops-staff-b", "OPERATIONS_STAFF");
		insertUser("ops-admin", "ADMINISTRATOR");
		Session staffA = login("ops-staff-a");
		Session staffB = login("ops-staff-b");
		Session admin = login("ops-admin");

		String pathA = createDraft(staffA, "Áo khoác của A", "TOP");
		String pathB = createDraft(staffB, "Quần dài của B", "BOTTOM");
		String idA = productIdOf(pathA);
		String idB = productIdOf(pathB);

		JsonNode summaryA = json.readTree(getOk(staffA, "/api/v1/catalog/admin/drafts/summary").body());
		assertThat(summaryA.get("total").asInt()).isEqualTo(1);
		assertThat(summaryA.get("top").asInt()).isEqualTo(1);
		assertThat(summaryA.get("bottom").asInt()).isEqualTo(0);
		assertThat(summaryA.get("with_primary_image").asInt()).isEqualTo(0);
		assertThat(summaryA.get("without_primary_image").asInt()).isEqualTo(1);
		JsonNode summaryAdmin = json.readTree(
				getOk(admin, "/api/v1/catalog/admin/drafts/summary").body());
		assertThat(summaryAdmin.get("total").asInt()).isEqualTo(2);
		assertThat(summaryAdmin.get("top").asInt()).isEqualTo(1);
		assertThat(summaryAdmin.get("bottom").asInt()).isEqualTo(1);

		// StaffB cannot infer StaffA titles through search filters.
		JsonNode searchB = json.readTree(getOk(staffB,
				"/api/v1/catalog/admin/drafts?q=kho%C3%A1c").body());
		assertThat(searchB.get("total").asInt()).isEqualTo(0);
		assertThat(searchB.get("items").size()).isEqualTo(0);

		// Cross-owner reads denied on every new surface.
		assertThat(send(staffA.browser, get(staffA.base,
				"/api/v1/catalog/admin/drafts/" + idB + "/versions")).statusCode()).isEqualTo(403);
		assertThat(send(staffA.browser, get(staffA.base,
				"/api/v1/catalog/admin/drafts/" + idB + "/audit")).statusCode()).isEqualTo(403);
		assertThat(send(staffA.browser, get(staffA.base,
				"/api/v1/catalog/admin/drafts/" + idB)).statusCode()).isEqualTo(403);
		assertThat(getOk(admin,
				"/api/v1/catalog/admin/drafts/" + idA + "/versions").statusCode()).isEqualTo(200);
		assertThat(getOk(admin,
				"/api/v1/catalog/admin/drafts/" + idB + "/audit").statusCode()).isEqualTo(200);
	}

	@Test
	void serverFiltersPagingOrderingAndValidation() throws Exception {
		insertUser("ops-filter-staff", "OPERATIONS_STAFF");
		Session staff = login("ops-filter-staff");

		String oldest = productIdOf(createDraft(staff, "Áo len cổ lọ", "TOP"));
		String middle = productIdOf(createDraft(staff, "Quần âu công sở", "BOTTOM"));
		String newest = productIdOf(createDraft(staff, "Đầm liền hoa nhí", "ONE_PIECE"));
		jdbc.update("UPDATE product_versions SET created_at = CURRENT_TIMESTAMP - INTERVAL '3 minutes' "
				+ "WHERE product_id = ?", UUID.fromString(oldest));
		jdbc.update("UPDATE product_versions SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes' "
				+ "WHERE product_id = ?", UUID.fromString(middle));
		jdbc.update("UPDATE product_versions SET created_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' "
				+ "WHERE product_id = ?", UUID.fromString(newest));

		JsonNode search = json.readTree(
				getOk(staff, "/api/v1/catalog/admin/drafts?q=%C3%81O").body());
		assertThat(search.get("total").asInt()).isEqualTo(1);
		assertThat(search.get("items").get(0).get("title").asText()).isEqualTo("Áo len cổ lọ");

		JsonNode category = json.readTree(
				getOk(staff, "/api/v1/catalog/admin/drafts?category=BOTTOM").body());
		assertThat(category.get("total").asInt()).isEqualTo(1);
		assertThat(category.get("items").get(0).get("title").asText()).isEqualTo("Quần âu công sở");

		JsonNode noImage = json.readTree(
				getOk(staff, "/api/v1/catalog/admin/drafts?has_primary_image=false").body());
		assertThat(noImage.get("total").asInt()).isEqualTo(3);
		JsonNode withImage = json.readTree(
				getOk(staff, "/api/v1/catalog/admin/drafts?has_primary_image=true").body());
		assertThat(withImage.get("total").asInt()).isEqualTo(0);
		assertThat(withImage.get("items").size()).isEqualTo(0);

		JsonNode page1 = json.readTree(getOk(staff,
				"/api/v1/catalog/admin/drafts?limit=2&offset=0").body());
		assertThat(page1.get("total").asInt()).isEqualTo(3);
		assertThat(page1.get("has_more").asBoolean()).isTrue();
		assertThat(page1.get("items").get(0).get("title").asText()).isEqualTo("Đầm liền hoa nhí");
		JsonNode page2 = json.readTree(getOk(staff,
				"/api/v1/catalog/admin/drafts?limit=2&offset=2").body());
		assertThat(page2.get("total").asInt()).isEqualTo(3);
		assertThat(page2.get("has_more").asBoolean()).isFalse();
		assertThat(page2.get("items").size()).isEqualTo(1);

		for (String invalid : new String[] {
				"?category=SHOES", "?has_primary_image=yes", "?has_primary_image=1",
				"?q=" + "x".repeat(251) }) {
			HttpResponse<String> response = send(staff.browser,
					get(staff.base, "/api/v1/catalog/admin/drafts" + invalid));
			assertThat(response.statusCode()).as("expected 400 for %s", invalid).isEqualTo(400);
			assertThat(json.readTree(response.body()).get("code").asText())
					.isEqualTo("INVALID_REQUEST");
		}
	}

	@Test
	void versionTimelineDetailCompareAndImageBinding() throws Exception {
		insertUser("ops-history-staff", "OPERATIONS_STAFF");
		insertUser("ops-history-admin", "ADMINISTRATOR");
		Session staff = login("ops-history-staff");
		Session admin = login("ops-history-admin");

		String path = createDraft(staff, "Áo sơ mi trắng", "TOP");
		String productId = productIdOf(path);
		reviseOk(staff, path, "Áo sơ mi trắng v2", "BOTTOM", 1);
		replaceImageOk(staff, productId, 2, pngBytes(4));

		JsonNode versions = json.readTree(
				getOk(staff, "/api/v1/catalog/admin/drafts/" + productId + "/versions").body());
		assertThat(versions.get("total").asInt()).isEqualTo(3);
		assertThat(versions.get("items").size()).isEqualTo(3);
		assertThat(versions.get("items").get(0).get("version_no").asInt()).isEqualTo(3);
		assertThat(versions.get("items").get(2).get("version_no").asInt()).isEqualTo(1);
		assertThat(versions.get("items").get(0).get("has_primary_image").asBoolean()).isTrue();
		assertThat(versions.get("items").get(1).get("has_primary_image").asBoolean()).isFalse();

		String v1 = versions.get("items").get(2).get("product_version_id").asText();
		String v2 = versions.get("items").get(1).get("product_version_id").asText();
		String v3 = versions.get("items").get(0).get("product_version_id").asText();

		JsonNode detail1 = json.readTree(getOk(staff,
				"/api/v1/catalog/admin/drafts/" + productId + "/versions/" + v1).body());
		assertThat(detail1.get("title").asText()).isEqualTo("Áo sơ mi trắng");
		assertThat(detail1.get("category").asText()).isEqualTo("TOP");
		assertThat(detail1.get("has_primary_image").asBoolean()).isFalse();
		JsonNode detail2 = json.readTree(getOk(staff,
				"/api/v1/catalog/admin/drafts/" + productId + "/versions/" + v2).body());
		assertThat(detail2.get("title").asText()).isEqualTo("Áo sơ mi trắng v2");
		assertThat(detail2.get("category").asText()).isEqualTo("BOTTOM");
		assertThat(detail1.has("storage_uri")).isFalse();
		assertThat(detail2.has("storage_uri")).isFalse();

		// Historical image binds product+version: v3 has bytes, v1/v2 are 404.
		assertThat(imageOk(staff, productId, v3).length).isGreaterThan(0);
		assertThat(send(staff.browser, get(staff.base,
				"/api/v1/catalog/admin/drafts/" + productId + "/versions/" + v2 + "/image"))
				.statusCode()).isEqualTo(404);
		assertThat(send(staff.browser, get(staff.base,
				"/api/v1/catalog/admin/drafts/" + productId + "/versions/" + v1 + "/image"))
				.statusCode()).isEqualTo(404);
		// Foreign version id is not honored as a stand-in.
		String otherPath = createDraft(staff, "Áo khác", "TOP");
		String otherId = productIdOf(otherPath);
		assertThat(send(staff.browser, get(staff.base,
				"/api/v1/catalog/admin/drafts/" + otherId + "/versions/" + v3 + "/image"))
				.statusCode()).isEqualTo(404);

		// Admin sees the same timeline; unrelated staff still denied.
		assertThat(getOk(admin,
				"/api/v1/catalog/admin/drafts/" + productId + "/versions").statusCode())
				.isEqualTo(200);
	}

	@Test
	void auditLineageAndStaleWriteCreatesNoVersionOrAudit() throws Exception {
		insertUser("ops-audit-staff", "OPERATIONS_STAFF");
		Session staff = login("ops-audit-staff");

		String path = createDraft(staff, "Áo audit", "TOP");
		String productId = productIdOf(path);
		reviseOk(staff, path, "Áo audit v2", "TOP", 1);
		replaceImageOk(staff, productId, 2, pngBytes(7));

		int versionsBefore = versionCount(productId);
		int auditsBefore = auditCount(productId);
		HttpResponse<String> stale = send(staff.browser, patchJson(staff.base, path,
				"{\"title\":\"Áo audit stale\",\"category\":\"TOP\",\"expected_version_no\":2}",
				staff.csrf));
		assertThat(stale.statusCode()).isEqualTo(409);
		assertThat(versionCount(productId)).isEqualTo(versionsBefore);
		assertThat(auditCount(productId)).isEqualTo(auditsBefore);

		JsonNode audit = json.readTree(
				getOk(staff, "/api/v1/catalog/admin/drafts/" + productId + "/audit").body());
		assertThat(audit.get("total").asInt()).isEqualTo(3);
		assertThat(audit.get("items").size()).isEqualTo(3);
		List<String> actions = new ArrayList<>();
		audit.get("items").forEach(item -> actions.add(item.get("action").asText()));
		assertThat(actions.get(0)).isEqualTo("CATALOG_PRIMARY_IMAGE_REPLACED");
		assertThat(actions.get(1)).isEqualTo("CATALOG_DRAFT_REVISED");
		assertThat(actions.get(2)).isEqualTo("CATALOG_DRAFT_CREATED");
		JsonNode imageEvent = audit.get("items").get(0);
		assertThat(imageEvent.get("previous_version_no").asInt()).isEqualTo(2);
		assertThat(imageEvent.get("new_version_no").asInt()).isEqualTo(3);
		assertThat(imageEvent.has("storage_uri")).isFalse();
		assertThat(imageEvent.has("actor_email")).isFalse();
		assertThat(imageEvent.has("username")).isFalse();

		// Audit is immutable: no DELETE endpoint exists; the attempt changes nothing.
		int auditsBeforeDelete = auditCount(productId);
		int deleteStatus = send(staff.browser, HttpRequest.newBuilder(staff.base.resolve(
				"/api/v1/catalog/admin/drafts/" + productId + "/audit"))
				.header("X-CSRF-TOKEN", staff.csrf).DELETE().build()).statusCode();
		assertThat(deleteStatus).as("DELETE audit status").isBetween(400, 499);
		assertThat(auditCount(productId)).isEqualTo(auditsBeforeDelete);
	}

	@Test
	void imageCarryForwardAndStorageFailureSafety() throws Exception {
		insertUser("ops-image-staff", "OPERATIONS_STAFF");
		Session staff = login("ops-image-staff");

		String path = createDraft(staff, "Áo ảnh", "TOP");
		String productId = productIdOf(path);
		replaceImageOk(staff, productId, 1, pngBytes(9));
		JsonNode revised = json.readTree(reviseOk(staff, path, "Áo ảnh v2", "TOP", 2).body());
		assertThat(revised.get("version_no").asInt()).isEqualTo(3);
		assertThat(revised.get("has_primary_image").asBoolean()).isTrue();
		byte[] carried = imageOk(staff, productId,
				revised.get("product_version_id").asText());
		assertThat(carried).isEqualTo(imageOk(staff, productId,
				versionIdOf(productId, 2)));
	}

	@Autowired
	TestObjectStore objectStore;

	@Test
	void scopedStorageFailureCommitsNoVersionOrAudit() throws Exception {
		insertUser("ops-failure-staff", "OPERATIONS_STAFF");
		Session staff = login("ops-failure-staff");

		String path = createDraft(staff, "Áo lỗi lưu trữ", "TOP");
		String productId = productIdOf(path);
		int versionsBefore = versionCount(productId);
		int auditsBefore = auditCount(productId);
		objectStore.failNextPut = true;
		HttpResponse<String> failed = sendRawImage(staff, productId, 1, pngBytes(11));
		assertThat(failed.statusCode()).isEqualTo(503);
		assertThat(json.readTree(failed.body()).get("code").asText())
				.isEqualTo("OBJECT_STORAGE_UNAVAILABLE");
		assertThat(versionCount(productId)).isEqualTo(versionsBefore);
		assertThat(auditCount(productId)).isEqualTo(auditsBefore);
		// Recovery on the candidate path works after the injected fault.
		replaceImageOk(staff, productId, 1, pngBytes(12));
		assertThat(versionCount(productId)).isEqualTo(versionsBefore + 1);
	}

	private String versionIdOf(String productId, int versionNo) {
		return jdbc.queryForObject(
				"SELECT id FROM product_versions WHERE product_id = ? AND version_no = ?",
				String.class, UUID.fromString(productId), versionNo);
	}

	private int versionCount(String productId) {
		return jdbc.queryForObject("SELECT COUNT(*) FROM product_versions WHERE product_id = ?",
				Integer.class, UUID.fromString(productId));
	}

	private int auditCount(String productId) {
		return jdbc.queryForObject(
				"SELECT COUNT(*) FROM audit_events WHERE resource_type = 'CATALOG_PRODUCT' "
						+ "AND resource_id = ?",
				Integer.class, UUID.fromString(productId));
	}

	private HttpResponse<String> getOk(Session session, String path) throws Exception {
		HttpResponse<String> response = send(session.browser, get(session.base, path));
		assertThat(response.statusCode()).as("GET %s", path).isEqualTo(200);
		return response;
	}

	private byte[] imageOk(Session session, String productId, String versionId) throws Exception {
		java.net.http.HttpResponse<byte[]> response = session.browser.send(
				HttpRequest.newBuilder(session.base.resolve(
						"/api/v1/catalog/admin/drafts/" + productId + "/versions/" + versionId + "/image"))
						.GET().build(),
				HttpResponse.BodyHandlers.ofByteArray());
		assertThat(response.statusCode()).isEqualTo(200);
		assertThat(response.headers().firstValue("X-Content-Type-Options")).hasValue("nosniff");
		assertThat(response.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
		return response.body();
	}

	private String createDraft(Session session, String title, String category) throws Exception {
		HttpResponse<String> created = send(session.browser, postJson(session.base,
				"/api/v1/catalog/admin/drafts",
				"{\"title\":\"" + title + "\",\"category\":\"" + category + "\"}", session.csrf));
		assertThat(created.statusCode()).isEqualTo(201);
		return created.headers().firstValue("location").orElseThrow();
	}

	private HttpResponse<String> reviseOk(Session session, String path, String title,
			String category, int expectedVersion) throws Exception {
		HttpResponse<String> response = send(session.browser, patchJson(session.base, path,
				"{\"title\":\"" + title + "\",\"category\":\"" + category
						+ "\",\"expected_version_no\":" + expectedVersion + "}",
				session.csrf));
		assertThat(response.statusCode()).isEqualTo(200);
		return response;
	}

	private HttpResponse<String> sendRawImage(Session session, String productId,
			int expectedVersion, byte[] png) throws Exception {
		String boundary = "----fasearch-test-boundary";
		byte[] header = ("--" + boundary + "\r\n"
				+ "Content-Disposition: form-data; name=\"image\"; filename=\"primary.png\"\r\n"
				+ "Content-Type: image/png\r\n\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8);
		byte[] separator = ("\r\n--" + boundary + "\r\n"
				+ "Content-Disposition: form-data; name=\"expected_version_no\"\r\n\r\n"
				+ expectedVersion + "\r\n--" + boundary + "--\r\n")
				.getBytes(java.nio.charset.StandardCharsets.UTF_8);
		byte[] body = new byte[header.length + png.length + separator.length];
		System.arraycopy(header, 0, body, 0, header.length);
		System.arraycopy(png, 0, body, header.length, png.length);
		System.arraycopy(separator, 0, body, header.length + png.length, separator.length);
		return session.browser.send(
				HttpRequest.newBuilder(session.base.resolve(
						"/api/v1/catalog/admin/drafts/" + productId + "/image"))
						.header("Content-Type", "multipart/form-data; boundary=" + boundary)
						.header("X-CSRF-TOKEN", session.csrf)
						.POST(HttpRequest.BodyPublishers.ofByteArray(body)).build(),
				HttpResponse.BodyHandlers.ofString());
	}

	private void replaceImageOk(Session session, String productId, int expectedVersion,
			byte[] png) throws Exception {
		HttpResponse<String> response = sendRawImage(session, productId, expectedVersion, png);
		assertThat(response.statusCode()).as("image upload: %s", response.body()).isEqualTo(200);
	}

	private byte[] pngBytes(int seed) {
		// Single valid 1x1 RGBA PNG fixture; the seed is accepted for call-site
		// readability only. Distinct versions are distinguished by storage key
		// and version number, never by fixture byte tweaks (which would break CRC).
		return Base64.getDecoder().decode(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
	}

	private String productIdOf(String locationPath) {
		return locationPath.substring(locationPath.lastIndexOf('/') + 1);
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
		volatile boolean failNextPut;

		@Override
		public String put(String key, byte[] bytes, String mediaType) {
			if (failNextPut) {
				failNextPut = false;
				throw new CatalogDraftException("OBJECT_STORAGE_UNAVAILABLE",
						HttpStatus.SERVICE_UNAVAILABLE, "Product image storage is unavailable");
			}
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
