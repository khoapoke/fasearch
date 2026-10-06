package com.fasearch.backend.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.json.JsonMapper;

// M1 deterministic revocation schedules. Test-only scheduling controls at real
// framework boundaries (SessionRepository.save + UserDetailsService load); they
// hold timing only, never decide passwords or session content. Production code
// is untouched by the gates. Each test records gate-entry / change-commit /
// gate-exit timestamps and asserts the forced order BEFORE treating the HTTP
// oracle as proof. Oracle is always real HTTP (/me + protected mutation),
// never private state alone.
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
		"FASEARCH_BOOTSTRAP_ADMIN_USERNAME=bootstrap-admin",
		"FASEARCH_BOOTSTRAP_ADMIN_EMAIL=bootstrap@example.test",
		"FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Test-only-Strong-Passphrase-123"
})
class AccountSessionGateIntegrationTests {

	static final String INITIAL = "a-very-long-test-passphrase-01";
	static final long GATE_TIMEOUT_SECONDS = 20;

	@Container
	@ServiceConnection
	static PostgreSQLContainer database = new PostgreSQLContainer("postgres:16-alpine");

	@Value("${local.server.port}")
	int port;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	JsonMapper json;

	@BeforeEach
	void resetGates() {
		Gates.control().reset();
	}

	@TestConfiguration
	static class Gates {
		private static final Control CONTROL = new Control();

		static Control control() {
			return CONTROL;
		}

		@Bean
		static BeanPostProcessor gatePostProcessor() {
			return new BeanPostProcessor() {
				@Override
				public Object postProcessAfterInitialization(Object bean, String name) {
					if (bean instanceof SessionRegistry) {
						return bean;
					}
					if (bean instanceof SessionRepository) {
						return interfaceProxy(bean, (proxy, method, args) -> {
							if (method.getName().equals("save") && args.length == 1
									&& args[0] instanceof Session session) {
								CONTROL.onSave(session);
							}
							Object result;
							try {
								result = method.invoke(bean, args);
							}
							catch (java.lang.reflect.InvocationTargetException failed) {
								throw failed.getCause();
							}
							if (method.getName().equals("findById") && args.length == 1
									&& args[0] instanceof String id) {
								CONTROL.onSessionLoaded(id);
							}
							return result;
						});
					}
					if (bean instanceof UserDetailsService) {
						return interfaceProxy(bean, (proxy, method, args) -> {
							Object loaded;
							try {
								loaded = method.invoke(bean, args);
							}
							catch (java.lang.reflect.InvocationTargetException failed) {
								throw failed.getCause();
							}
							if (method.getName().equals("loadUserByUsername")
									&& args.length == 1 && args[0] instanceof String loadedName) {
								CONTROL.onUserLoaded(loadedName);
							}
							return loaded;
						});
					}
					return bean;
				}
			};
		}

		private static Object interfaceProxy(Object target, InvocationHandler handler) {
			return Proxy.newProxyInstance(target.getClass().getClassLoader(),
					target.getClass().getInterfaces(), handler);
		}
	}

	// One-shot, single-thread-test control. Armed per test, released in order,
	// always bounded; a missed schedule fails loudly instead of passing quietly.
	static final class Control {
		private final AtomicReference<Predicate<Session>> saveWhen = new AtomicReference<>();
		private final AtomicReference<Predicate<String>> loadWhen = new AtomicReference<>();
		private final AtomicReference<Predicate<String>> sessionLoadWhen = new AtomicReference<>();
		private volatile CountDownLatch saveReached = new CountDownLatch(1);
		private volatile CountDownLatch saveRelease = new CountDownLatch(1);
		private volatile CountDownLatch loadReached = new CountDownLatch(1);
		private volatile CountDownLatch loadRelease = new CountDownLatch(1);
		private volatile CountDownLatch sessionLoadReached = new CountDownLatch(1);
		private volatile CountDownLatch sessionLoadRelease = new CountDownLatch(1);
		private final AtomicLong saveEnteredAt = new AtomicLong();
		private final AtomicLong saveExitedAt = new AtomicLong();
		private final AtomicLong loadReachedAt = new AtomicLong();
		private final AtomicLong sessionLoadReachedAt = new AtomicLong();

		synchronized void reset() {
			saveWhen.set(null);
			loadWhen.set(null);
			sessionLoadWhen.set(null);
			saveReached = new CountDownLatch(1);
			saveRelease = new CountDownLatch(1);
			loadReached = new CountDownLatch(1);
			loadRelease = new CountDownLatch(1);
			sessionLoadReached = new CountDownLatch(1);
			sessionLoadRelease = new CountDownLatch(1);
			saveEnteredAt.set(0);
			saveExitedAt.set(0);
			loadReachedAt.set(0);
			sessionLoadReachedAt.set(0);
		}

		void armSessionLoad(Predicate<String> when) {
			sessionLoadWhen.set(when);
		}

		void onSessionLoaded(String id) {
			Predicate<String> when = sessionLoadWhen.get();
			if (when == null || !when.test(id)) {
				return;
			}
			sessionLoadWhen.set(null);
			sessionLoadReachedAt.set(System.nanoTime());
			sessionLoadReached.countDown();
			await(sessionLoadRelease, "session-load gate was never released");
		}

		void awaitSessionLoadReached() {
			assertThat(await(sessionLoadReached, "session-load-reached"))
					.as("schedule not reached: session load never arrived at the gate")
					.isTrue();
		}

		void releaseSessionLoad() {
			sessionLoadRelease.countDown();
		}

		long sessionLoadReachedAt() {
			return sessionLoadReachedAt.get();
		}

		void armSave(Predicate<Session> when) {
			saveWhen.set(when);
		}

		void armLoad(Predicate<String> when) {
			loadWhen.set(when);
		}

		void onSave(Session session) {
			Predicate<Session> when = saveWhen.get();
			if (when == null || !when.test(session)) {
				return;
			}
			saveWhen.set(null);
			saveEnteredAt.set(System.nanoTime());
			saveReached.countDown();
			await(saveRelease, "session-save gate was never released");
			saveExitedAt.set(System.nanoTime());
		}

		void onUserLoaded(String username) {
			Predicate<String> when = loadWhen.get();
			if (when == null || !when.test(username)) {
				return;
			}
			loadWhen.set(null);
			loadReachedAt.set(System.nanoTime());
			loadReached.countDown();
			await(loadRelease, "user-load gate was never released");
		}

		void awaitSaveReached() {
			assertThat(await(saveReached, "save-reached"))
					.as("schedule not reached: session save never arrived at the gate")
					.isTrue();
		}

		void awaitLoadReached() {
			assertThat(await(loadReached, "load-reached"))
					.as("schedule not reached: credential read never arrived at the gate")
					.isTrue();
		}

		void releaseSave() {
			saveRelease.countDown();
		}

		void releaseLoad() {
			loadRelease.countDown();
		}

		long saveEnteredAt() {
			return saveEnteredAt.get();
		}

		long saveExitedAt() {
			return saveExitedAt.get();
		}

		long loadReachedAt() {
			return loadReachedAt.get();
		}

		private static boolean await(CountDownLatch latch, String what) {
			try {
				return latch.await(GATE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
			}
			catch (InterruptedException interrupted) {
				Thread.currentThread().interrupt();
				throw new AssertionError("interrupted waiting for " + what, interrupted);
			}
		}
	}

	// L1: stale-credential login must cross the password-change commit BEFORE
	// its session save, and the minted session must be unusable afterwards.
	// Deterministic park-then-arm order: the racer parks at the credential
	// read; ALL changer traffic completes; only then the save gate arms, so the
	// only matching save left in the system is the racer's own.
	@Test
	void staleLoginCrossingPasswordChangeLeavesNoLiveSession() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		Client seeder = Client.register(base, json, "gate_login_user", "gate_login_user@example.test");
		assertThat(seeder.loginAs("gate_login_user", INITIAL)).isEqualTo(200);
		Client other = Client.register(base, json, "gate_login_other", "gate_login_other@example.test");
		assertThat(other.loginAs("gate_login_other", INITIAL)).isEqualTo(200);
		String renewed = "gate-login-new-passphrase-09";

		// Racing login fetches its CSRF first (anonymous session, no principal yet).
		Client racer = Client.anonymous(base, json);
		assertThat(racer.csrf()).isNotBlank();
		Control gates = Gates.control();
		gates.armLoad("gate_login_user"::equalsIgnoreCase);

		ExecutorService pool = Executors.newSingleThreadExecutor();
		try {
			Future<Integer> login = pool.submit(() -> racer.loginAs("gate_login_user", INITIAL));
			// Credential read happened pre-commit; password hash is now in memory
			// on the login thread while its session save is still ahead.
			gates.awaitLoadReached();

		Client changer = Client.loggedInAs(base, json, "gate_login_user", INITIAL);
		assertThat(changer.changePassword(INITIAL, renewed)).isEqualTo(204);
		long commitDoneAt = System.nanoTime();

		// Arm only now: the racer is still parked at the load gate, so its
		// save is the only future save carrying this principal. Changer is idle.
		gates.armSave(session -> "gate_login_user".equalsIgnoreCase(principalOf(session)));
		// The login thread now verifies the stale hash, mints a session and
		// reaches the save gate strictly after the commit above.
		gates.releaseLoad();
		gates.awaitSaveReached();
		assertThat(gates.saveEnteredAt())
					.as("save must arrive after the password-change commit")
					.isGreaterThan(commitDoneAt);
		gates.releaseSave();
		assertThat(login.get(60, TimeUnit.SECONDS)).isEqualTo(200);
		assertThat(gates.saveExitedAt()).isGreaterThan(commitDoneAt);

			// Oracle: the crossed login minted nothing usable.
			assertThat(racer.get("/api/v1/auth/me").statusCode())
					.as("stale login crossing the commit must not yield a live session")
					.isEqualTo(401);
			assertThat(sessionRows("gate_login_user")).isEqualTo(0);
			assertThat(Client.anonymous(base, json).loginAs("gate_login_user", INITIAL))
					.isEqualTo(401);
			assertThat(Client.anonymous(base, json).loginAs("gate_login_user", renewed))
					.isEqualTo(200);
			assertThat(other.get("/api/v1/auth/me").statusCode()).isEqualTo(200);
		}
		finally {
			gates.releaseLoad();
			gates.releaseSave();
			pool.shutdownNow();
		}
	}

	// L2: an already-authenticated session-touching request loads BEFORE the
	// revocation and saves AFTER the commit; the old cookie must stay dead and
	// must not resurrect a session row. The gate matches the victim session id
	// only, so the changer's own auxiliary saves never trip it.
	@Test
	void loadedSessionSavingAfterRevokeDoesNotResurrect() throws Exception {
		URI base = URI.create("http://127.0.0.1:" + port);
		Client user = Client.register(base, json, "gate_touch_user", "gate_touch_user@example.test");
		assertThat(user.loginAs("gate_touch_user", INITIAL)).isEqualTo(200);
		assertThat(user.get("/api/v1/auth/me").statusCode()).isEqualTo(200);
		Client other = Client.register(base, json, "gate_touch_other", "gate_touch_other@example.test");
		assertThat(other.loginAs("gate_touch_other", INITIAL)).isEqualTo(200);
		String renewed = "gate-touch-new-passphrase-09";
		// Cookie value is base64(session id) on the wire; the repository sees
		// the decoded id, so the gate predicate must compare decoded values.
		String victimSessionId = Client.decodedSessionId(user.sessionId());
		assertThat(victimSessionId).isNotBlank();

		// Changer logs in fully BEFORE arming, and its CSRF token is fetched up
		// front: tokens are stable per session, so the change POST needs no extra
		// session-touching request while the gate is armed.
		Client changer = Client.loggedInAs(base, json, "gate_touch_user", INITIAL);
		String changeToken = changer.csrf();
		assertThat(changeToken).isNotBlank();

		Control gates = Gates.control();
		// Park the in-flight request right after its session row is loaded
		// (pre-commit by construction: the change below only starts afterwards).
		// Framework detail: an unchanged session may never reach save, so the
		// load park -- not the save -- is the deterministic forcing point here.
		gates.armSessionLoad(victimSessionId::equals);
		ExecutorService pool = Executors.newSingleThreadExecutor();
		try {
			Future<Integer> inflight = pool.submit(() -> user.get("/api/v1/auth/me").statusCode());
		gates.awaitSessionLoadReached();

		assertThat(changer.changePasswordWithToken(INITIAL, renewed, changeToken))
				.isEqualTo(204);
			long commitDoneAt = System.nanoTime();

			assertThat(gates.sessionLoadReachedAt())
					.as("in-flight request must have loaded before the revocation")
					.isGreaterThan(0);
			gates.releaseSessionLoad();
			assertThat(inflight.get(60, TimeUnit.SECONDS)).isIn(200, 401);

			// Oracle: old cookie dead, no row resurrected, others intact.
			assertThat(user.get("/api/v1/auth/me").statusCode())
					.as("session used across the revocation must be dead afterwards")
					.isEqualTo(401);
			assertThat(sessionRows("gate_touch_user")).isEqualTo(0);
			assertThat(user.patchProfile("{\"display_name\":\"Ghost\"}").statusCode())
					.isEqualTo(401);
			assertThat(sessionRows("gate_touch_user")).isEqualTo(0);
			assertThat(Client.anonymous(base, json).loginAs("gate_touch_user", INITIAL))
					.isEqualTo(401);
			assertThat(Client.anonymous(base, json).loginAs("gate_touch_user", renewed))
					.isEqualTo(200);
			assertThat(other.get("/api/v1/auth/me").statusCode()).isEqualTo(200);
		}
		finally {
			gates.releaseSessionLoad();
			pool.shutdownNow();
		}
	}

	static String principalOf(Session session) {
		try {
			Object context = session.getAttribute("SPRING_SECURITY_CONTEXT");
			if (context instanceof org.springframework.security.core.context.SecurityContext
					security) {
				return security.getAuthentication() == null ? null
						: security.getAuthentication().getName();
			}
		}
		catch (RuntimeException ignored) {
		}
		return null;
	}

	private int sessionRows(String username) {
		return jdbc.queryForObject(
				"SELECT COUNT(*) FROM SPRING_SESSION WHERE PRINCIPAL_NAME = ?",
				Integer.class, username);
	}

	private static final class Client {
		private final URI base;
		private final JsonMapper json;
		private final HttpClient browser;
		private final CookieManager cookies;

		private Client(URI base, JsonMapper json, CookieManager cookies) {
			this.base = base;
			this.json = json;
			this.cookies = cookies;
			this.browser = HttpClient.newBuilder().cookieHandler(cookies).build();
		}

		static Client anonymous(URI base, JsonMapper json) {
			return new Client(base, json, new CookieManager(null, CookiePolicy.ACCEPT_ALL));
		}

		static Client register(URI base, JsonMapper json, String username, String email)
				throws Exception {
			Client client = anonymous(base, json);
			String csrf = client.csrf();
			HttpResponse<String> registered = client.browser.send(HttpRequest
					.newBuilder(base.resolve("/api/v1/auth/register"))
					.header("Content-Type", "application/json")
					.header("X-CSRF-TOKEN", csrf)
					.POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"" + username
							+ "\",\"email\":\"" + email
							+ "\",\"password\":\"" + INITIAL + "\"}")).build(),
					HttpResponse.BodyHandlers.ofString());
			assertThat(registered.statusCode()).isIn(201, 409);
			return client;
		}

		static Client loggedInAs(URI base, JsonMapper json, String username, String password)
				throws Exception {
			Client client = anonymous(base, json);
			assertThat(client.loginAs(username, password)).isEqualTo(200);
			return client;
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
			return changePasswordWithToken(current, next, csrf());
		}

		int changePasswordWithToken(String current, String next, String token) throws Exception {
			return browser.send(HttpRequest.newBuilder(base.resolve("/api/v1/auth/password"))
					.header("Content-Type", "application/json")
					.header("X-CSRF-TOKEN", token)
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

		static String decodedSessionId(String cookieValue) {
			try {
				return new String(java.util.Base64.getDecoder().decode(cookieValue),
						java.nio.charset.StandardCharsets.UTF_8);
			}
			catch (IllegalArgumentException notEncoded) {
				return cookieValue;
			}
		}

		String sessionId() {
			return cookies.getCookieStore().getCookies().stream()
					.filter(cookie -> cookie.getName().equals("FASEARCH_SESSION"))
					.map(HttpCookie::getValue)
					.findFirst().orElse("");
		}
	}
}
