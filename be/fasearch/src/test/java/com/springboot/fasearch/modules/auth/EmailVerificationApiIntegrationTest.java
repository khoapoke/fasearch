package com.springboot.fasearch.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.EmailTokenPurpose;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.auth.service.interfaces.EmailTokenService;

/**
 * IT vong doi email (candidate-only, che do LOG — khong gui mail that):
 * forgot (hang so) → reset (chet phien cu) → verify → banner emailVerified.
 *
 * <p>Chay qua {@code scripts/it-db/run-it.sh}: DB tach biet, bien
 * {@code PROMOTION_TEST_DB_*} (duoc script export san).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EmailVerificationApiIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String database = System.getenv("PROMOTION_TEST_DB_NAME");
        if (database == null || database.isBlank()) {
            throw new IllegalStateException("Set PROMOTION_TEST_DB_NAME to the isolated candidate database before running API tests");
        }
        registry.add("spring.datasource.url", () -> "jdbc:postgresql://"
                + env("PROMOTION_TEST_DB_HOST", "127.0.0.1") + ":"
                + env("PROMOTION_TEST_DB_PORT", "55440") + "/" + database);
        registry.add("spring.datasource.username", () -> env("PROMOTION_TEST_DB_USER", "fasearch"));
        registry.add("spring.datasource.password", () -> env("PROMOTION_TEST_DB_PASSWORD", ""));
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    @LocalServerPort private int port;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @Autowired private AccountRepository accountRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private EmailTokenService emailTokenService;
    @Autowired private PasswordEncoder passwordEncoder;

    private String suffix;
    private Account account;
    private String oldPassword = "MatKhauCu123";

    @BeforeEach
    void setUp() {
        suffix = "mail" + Long.toString(System.nanoTime(), 36);
        Role customerRole = roleRepository.findByName(RoleType.CUSTOMER).orElseThrow();
        account = accountRepository.saveAndFlush(Account.builder()
                .username("mail-it-" + suffix)
                .password(passwordEncoder.encode(oldPassword))
                .email("mail-it-" + suffix + "@example.invalid")
                .role(customerRole)
                .status(AccountStatus.ACTIVE)
                .isDeleted(false)
                .build());
    }

    @Test
    void forgotPasswordRespondsIdenticallyForUnknownAndKnownEmail() throws Exception {
        Resp unknown = call("POST", "/api/v1/auth/password/forgot",
                "{\"email\":\"khong-ton-tai-" + suffix + "@example.invalid\"}", null);
        Resp known = call("POST", "/api/v1/auth/password/forgot",
                "{\"email\":\"" + account.getEmail() + "\"}", null);

        assertThat(unknown.status()).isEqualTo(200);
        assertThat(known.status()).isEqualTo(200);
        assertThat(json(unknown).get("success").asBoolean()).isTrue();
        assertThat(json(known).get("message").asText()).isEqualTo(json(unknown).get("message").asText());
    }

    @Test
    void registerReportsUnverifiedThenVerifyFlipsBanner() throws Exception {
        String username = "mail-reg-" + suffix;
        String email = "mail-reg-" + suffix + "@example.invalid";
        Resp registered = call("POST", "/api/v1/auth/register", """
                {"username":"%s","password":"MatKhau123","email":"%s",
                 "firstName":"Kiem","lastName":"Thu","phoneNumber":"09%08d","gender":"MALE"}
                """.formatted(username, email, Math.floorMod(System.nanoTime(), 100_000_000L)), null);

        assertThat(registered.status()).isEqualTo(201);
        assertThat(result(registered).get("emailVerified").asBoolean()).isFalse();

        String loginToken = result(call("POST", "/api/v1/auth/login",
                "{\"username\":\"" + username + "\",\"password\":\"MatKhau123\"}", null))
                .get("accessToken").asText();
        assertThat(json(call("GET", "/api/v1/auth/my-info", null, loginToken))
                .get("result").get("emailVerified").asBoolean()).isFalse();

        Long accountId = accountRepository.findByUsername(username).orElseThrow().getId();
        String raw = emailTokenService.createEmailToken(accountId, EmailTokenPurpose.VERIFY_EMAIL);
        assertThat(call("POST", "/api/v1/auth/email/verify", "{\"token\":\"" + raw + "\"}", null).status())
                .isEqualTo(200);
        assertThat(json(call("GET", "/api/v1/auth/my-info", null, loginToken))
                .get("result").get("emailVerified").asBoolean()).isTrue();

        // Token da dung: xac nhan lai phai that bai.
        assertThat(call("POST", "/api/v1/auth/email/verify", "{\"token\":\"" + raw + "\"}", null).status())
                .isEqualTo(400);
    }

    @Test
    void invalidTokenIsRejected() {
        assertThat(call("POST", "/api/v1/auth/email/verify", "{\"token\":\"token-gia-mao\"}", null).status())
                .isEqualTo(400);
    }

    @Test
    void resetPasswordInvalidatesOldSession() throws Exception {
        String loginToken = result(call("POST", "/api/v1/auth/login",
                "{\"username\":\"" + account.getUsername() + "\",\"password\":\"" + oldPassword + "\"}", null))
                .get("accessToken").asText();
        assertThat(call("GET", "/api/v1/auth/my-info", null, loginToken).status()).isEqualTo(200);

        String raw = emailTokenService.createEmailToken(account.getId(), EmailTokenPurpose.RESET_PASSWORD);
        Resp reset = call("POST", "/api/v1/auth/password/reset",
                "{\"token\":\"" + raw + "\",\"newPassword\":\"MatKhauMoi456\"}", null);
        assertThat(reset.status()).isEqualTo(200);

        // Phien cu chet theo tokenVersion (giong doi mat khau).
        assertThat(call("GET", "/api/v1/auth/my-info", null, loginToken).status()).isEqualTo(401);

        // Dang nhap lai bang mat khau moi.
        Resp relogin = call("POST", "/api/v1/auth/login",
                "{\"username\":\"" + account.getUsername() + "\",\"password\":\"MatKhauMoi456\"}", null);
        assertThat(relogin.status()).isEqualTo(200);
    }

    @Test
    void verificationRequestEndpointSendsAgainForAuthenticatedAccount() throws Exception {
        String loginToken = result(call("POST", "/api/v1/auth/login",
                "{\"username\":\"" + account.getUsername() + "\",\"password\":\"" + oldPassword + "\"}", null))
                .get("accessToken").asText();

        Resp requested = call("POST", "/api/v1/auth/email/verification-request", "{}", loginToken);
        assertThat(requested.status()).isEqualTo(200);

        // Chua xac thuc -> van unverified.
        assertThat(json(call("GET", "/api/v1/auth/my-info", null, loginToken))
                .get("result").get("emailVerified").asBoolean()).isFalse();
    }

    @Test
    void forgotPasswordRateLimitTripsAfterFivePerHour() {
        String email = "gioi-han-" + suffix + "@example.invalid";
        for (int i = 0; i < 5; i++) {
            assertThat(call("POST", "/api/v1/auth/password/forgot",
                    "{\"email\":\"" + email + "\"}", null).status()).isEqualTo(200);
        }
        assertThat(call("POST", "/api/v1/auth/password/forgot",
                "{\"email\":\"" + email + "\"}", null).status()).isEqualTo(429);
    }

    private record Resp(int status, String body) {
    }

    private Resp call(String method, String path, String body, String token) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Content-Type", "application/json");
            if (token != null) {
                request.header("Authorization", "Bearer " + token);
            }
            request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body));
            HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
            return new Resp(response.statusCode(), response.body());
        } catch (Exception e) {
            throw new IllegalStateException("HTTP test call failed: " + method + " " + path, e);
        }
    }

    private JsonNode result(Resp response) throws Exception {
        assertThat(response.status()).as("body=%s", response.body()).isBetween(200, 299);
        return json(response).get("result");
    }

    private JsonNode json(Resp response) {
        try {
            return mapper.readTree(response.body());
        } catch (Exception e) {
            throw new IllegalStateException("Invalid JSON response", e);
        }
    }
}
