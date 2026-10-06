package com.fasearch.backend.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
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
import java.util.concurrent.atomic.AtomicInteger;

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

// Round-2 P0: obsolete credentials must not establish/resurrect a valid session
// after a password change. Public HTTP boundary only; no private-state assertions.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class AccountSessionRaceIntegrationTests {

	static final String INITIAL = "a-very-long-test-passphrase-01";

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
	void revokedSessionCannotActOrResurrectViaSessionTouchingRequests() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		Jar user = Jar.loggedIn(base, json, "race_revive_user", "race_revive_user@example.test");
		String obsoleteSessionId = user.sessionId();
		assertThat(obsoleteSessionId).isNotBlank();
		assertThat(user.get("/api/v1/auth/me").statusCode()).isEqualTo(200);

		assertThat(user.changePassword(INITIAL, "revive-proof-new-passphrase-03"))
				.isEqualTo(204);

		// Old session is dead.
		assertThat(user.get("/api/v1/auth/me").statusCode()).isEqualTo(401);
		// A session-touching request (CSRF issues a token into the session) with the
		// revoked cookie must NOT resurrect the old session: a fresh anonymous
		// session id is issued instead.
		assertThat(user.csrf()).isNotBlank();
		String renewedSessionId = user.sessionId();
		assertThat(renewedSessionId).isNotBlank();
		assertThat(renewedSessionId).isNotEqualTo(obsoleteSessionId);
		// Still anonymous afterwards; the obsolete principal has no session rows.
		assertThat(user.get("/api/v1/auth/me").statusCode()).isEqualTo(401);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME = 'race_revive_user'",
				Integer.class)).isEqualTo(0);
		// State-changing attempt on the dead session is 401, never applied.
		assertThat(user.patchProfile("{\"display_name\":\"Ghost\"}").statusCode())
				.isEqualTo(401);
		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME = 'race_revive_user'",
				Integer.class)).isEqualTo(0);
	}

	@Test
	void loginsRacingPasswordChangeLeaveNoLiveSession() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		for (int round = 0; round < 2; round++) {
			String username = "race_login_user_" + round;
			String email = username + "@example.test";
			String renewed = "race-login-new-passphrase-r" + round;
			Jar seeder = Jar.register(base, json, username, email);
			assertThat(seeder.loginAs(username, INITIAL)).isEqualTo(200);

			CountDownLatch start = new CountDownLatch(1);
			AtomicInteger launched = new AtomicInteger();
			var pool = Executors.newFixedThreadPool(4);
			try {
				List<Callable<String>> loginTasks = new ArrayList<>();
				for (int i = 0; i < 20; i++) {
					loginTasks.add(() -> {
						start.await(10, TimeUnit.SECONDS);
						Jar attempt = Jar.anonymous(base, json);
						int status = attempt.loginAs(username, INITIAL);
						launched.incrementAndGet();
						return status == 200 ? attempt.sessionId() : "";
					});
				}
				Callable<Integer> changeTask = () -> {
					start.await(10, TimeUnit.SECONDS);
					while (launched.get() < 3) {
						Thread.sleep(25);
					}
					Jar changer = Jar.loggedInAs(base, json, username, INITIAL);
					return changer.changePassword(INITIAL, renewed);
				};
				List<Future<String>> loginFutures = loginTasks.stream()
						.map(pool::submit).toList();
				Future<Integer> changeFuture = pool.submit(changeTask);
				start.countDown();
				List<String> capturedSessions = new ArrayList<>();
				for (Future<String> future : loginFutures) {
					String sessionId = future.get(60, TimeUnit.SECONDS);
					if (!sessionId.isBlank()) {
						capturedSessions.add(sessionId);
					}
				}
				assertThat(changeFuture.get(60, TimeUnit.SECONDS)).isEqualTo(204);
				// Every session minted from the racing logins must be dead now:
				// a 200 here proves a post-revoke resurrection.
				for (String sessionId : capturedSessions) {
					assertThat(meWithSession(base, sessionId))
							.as("racing session must not survive password change")
							.isEqualTo(401);
				}
				assertThat(jdbc.queryForObject(
						"SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME = ?",
						Integer.class, username)).isEqualTo(0);
				assertThat(Jar.anonymous(base, json).loginAs(username, INITIAL)).isEqualTo(401);
				assertThat(Jar.anonymous(base, json).loginAs(username, renewed)).isEqualTo(200);
			}
			finally {
				pool.shutdownNow();
			}
		}
	}

	private int meWithSession(URI base, String sessionId) throws Exception {
		HttpRequest request = HttpRequest.newBuilder(base.resolve("/api/v1/auth/me"))
				.header("Cookie", "FASEARCH_SESSION=" + sessionId)
				.GET().build();
		return HttpClient.newHttpClient().send(request,
				HttpResponse.BodyHandlers.ofString()).statusCode();
	}

	private static final class Jar {
		private final URI base;
		private final JsonMapper json;
		private final HttpClient browser;
		private final CookieManager cookies;

		private Jar(URI base, JsonMapper json, CookieManager cookies) {
			this.base = base;
			this.json = json;
			this.cookies = cookies;
			this.browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		}

		static Jar anonymous(URI base, JsonMapper json) {
			return new Jar(base, json, new CookieManager(null, CookiePolicy.ACCEPT_ALL));
		}

		static Jar register(URI base, JsonMapper json, String username, String email)
				throws Exception {
			Jar jar = new Jar(base, json,
					new CookieManager(null, CookiePolicy.ACCEPT_ALL));
			String csrf = jar.csrf();
			HttpResponse<String> registered = jar.browser.send(HttpRequest
					.newBuilder(base.resolve("/api/v1/auth/register"))
					.header("Content-Type", "application/json")
					.header("X-CSRF-TOKEN", csrf)
					.POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"" + username
							+ "\",\"email\":\"" + email
							+ "\",\"password\":\"" + INITIAL + "\"}")).build(),
					HttpResponse.BodyHandlers.ofString());
			assertThat(registered.statusCode()).isIn(201, 409);
			return jar;
		}

		static Jar loggedIn(URI base, JsonMapper json, String username, String email)
				throws Exception {
			Jar jar = register(base, json, username, email);
			assertThat(jar.loginAs(username, INITIAL)).isEqualTo(200);
			return jar;
		}

		static Jar loggedInAs(URI base, JsonMapper json, String username, String password)
				throws Exception {
			Jar jar = new Jar(base, json,
					new CookieManager(null, CookiePolicy.ACCEPT_ALL));
			assertThat(jar.loginAs(username, password)).isEqualTo(200);
			return jar;
		}

		int login(String password) throws Exception {
			throw new UnsupportedOperationException("use loginAs");
		}

		int loginAs(String username, String password) throws Exception {
			String csrf = csrf();
			return browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/login"))
					.header("Content-Type", "application/x-www-form-urlencoded")
					.header("X-CSRF-TOKEN", csrf)
					.POST(HttpRequest.BodyPublishers.ofString(
							"username=" + username + "&password=" + password)).build(),
					HttpResponse.BodyHandlers.ofString()).statusCode();
		}

		int changePassword(String current, String next) throws Exception {
			String csrf = csrf();
			return browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/password"))
					.header("Content-Type", "application/json")
					.header("X-CSRF-TOKEN", csrf)
					.POST(HttpRequest.BodyPublishers.ofString("{\"current_password\":\""
							+ current + "\",\"new_password\":\"" + next + "\"}")).build(),
					HttpResponse.BodyHandlers.ofString()).statusCode();
		}

		HttpResponse<String> patchProfile(String payload) throws Exception {
			String csrf = csrf();
			return browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/profile"))
					.header("Content-Type", "application/json")
					.header("X-CSRF-TOKEN", csrf)
					.method("PATCH", HttpRequest.BodyPublishers.ofString(payload)).build(),
					HttpResponse.BodyHandlers.ofString());
		}

		HttpResponse<String> get(String path) throws Exception {
			return browser.send(HttpRequest.newBuilder(base.resolve(path)).GET().build(),
					HttpResponse.BodyHandlers.ofString());
		}

		String csrf() throws Exception {
			HttpResponse<String> response = browser.send(HttpRequest.newBuilder(
					base.resolve("/api/v1/auth/csrf")).GET().build(),
					HttpResponse.BodyHandlers.ofString());
			assertThat(response.statusCode()).isEqualTo(200);
			return json.readTree(response.body()).get("token").asText();
		}

		String sessionId() {
			return cookies.getCookieStore().getCookies().stream()
					.filter(cookie -> cookie.getName().equals("FASEARCH_SESSION"))
					.map(HttpCookie::getValue)
					.findFirst().orElse("");
		}
	}
}
