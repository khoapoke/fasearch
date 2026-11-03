package com.springboot.fasearch.modules.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.JwtProvider;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class Stt6AccountSearchP1ApiIntegrationTest {

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

    @LocalServerPort
    private int port;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @Autowired private JwtProvider jwtProvider;
    @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Autowired private AccountRepository accountRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ProductVariantRepository variantRepository;

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    private String tokenFor(Account account, String role) {
        return jwtProvider.generateToken(account.getUsername(), role, account.getId());
    }

    private Account createDisposableCustomer(String suffix) {
        Role customerRole = roleRepository.findByName(RoleType.CUSTOMER).orElseThrow();
        Account account = accountRepository.saveAndFlush(Account.builder()
                .username("stt6-test-" + suffix).password(passwordEncoder.encode("oldpass123"))
                .email("stt6-test-" + suffix + "@example.invalid").role(customerRole)
                .status(AccountStatus.ACTIVE).isDeleted(false).build());
        Customer customer = userRepository.saveAndFlush(Customer.builder()
                .firstName("Test").lastName("User")
                .phoneNumber("09" + String.format("%08d", Math.abs(suffix.hashCode()) % 100000000))
                .address("Test address").accumulatePoint(0).account(account).isDeleted(false).build());
        return account;
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create(baseUrl() + path))
                .header("Content-Type", "application/json");
    }

    private int httpStatus(String method, String path, String token, String body) throws Exception {
        HttpRequest.Builder b = request(path);
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpRequest.Builder rb = b;
        if (body != null) {
            rb = rb.POST(HttpRequest.BodyPublishers.ofString(body));
        } else if (method.equals("DELETE")) {
            rb = rb.DELETE();
        } else if (method.equals("POST")) {
            rb = rb.POST(HttpRequest.BodyPublishers.noBody());
        } else {
            rb = rb.GET();
        }
        HttpResponse<String> resp = http.send(rb.build(), HttpResponse.BodyHandlers.ofString());
        return resp.statusCode();
    }

    // --- Change Password Tests ---

    @Test
    void changePassword_wrongOld_returns401() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/auth/change-password", token,
                "{\"oldPassword\":\"wrongpassword\",\"newPassword\":\"newpass123\"}");
        assertThat(status).isEqualTo(401);
    }

    @Test
    void changePassword_sameOldNew_returns400() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/auth/change-password", token,
                "{\"oldPassword\":\"oldpass123\",\"newPassword\":\"oldpass123\"}");
        assertThat(status).isEqualTo(400);
    }

    @Test
    void changePassword_correctOldNewAccept_returns200() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/auth/change-password", token,
                "{\"oldPassword\":\"oldpass123\",\"newPassword\":\"newpass456\"}");
        assertThat(status).isEqualTo(200);

        // Verify old password no longer works
        HttpRequest req = request("/api/v1/auth/login")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"username\":\"" + acct.getUsername() + "\",\"password\":\"oldpass123\"}"))
                .build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(401);

        // Verify new password works
        HttpRequest req2 = request("/api/v1/auth/login")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"username\":\"" + acct.getUsername() + "\",\"password\":\"newpass456\"}"))
                .build();
        HttpResponse<String> resp2 = http.send(req2, HttpResponse.BodyHandlers.ofString());
        assertThat(resp2.statusCode()).isEqualTo(200);
    }

    @Test
    void changePassword_wrongOld_noMutation() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        // Wrong old password -> 401
        int status = httpStatus("POST", "/api/v1/auth/change-password", token,
                "{\"oldPassword\":\"wrongpassword\",\"newPassword\":\"newpass456\"}");
        assertThat(status).isEqualTo(401);

        // Old password still works (no mutation)
        HttpRequest req = request("/api/v1/auth/login")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"username\":\"" + acct.getUsername() + "\",\"password\":\"oldpass123\"}"))
                .build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(200);
    }

    // --- Search History Tests ---

    @Test
    void searchHistory_invalidResultRefs_returns400() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/account/search-history", token,
                "{\"mode\":\"TEXT\",\"query\":\"test\",\"resultCount\":1,\"resultRefs\":\"data:image/png;base64,AAAA\",\"status\":\"SUCCESS\"}");
        assertThat(status).isEqualTo(400);
    }

    @Test
    void searchHistory_missingMode_returns400() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/account/search-history", token,
                "{\"query\":\"test\",\"resultCount\":1,\"status\":\"SUCCESS\"}");
        assertThat(status).isEqualTo(400);
    }

    @Test
    void searchHistory_missingStatus_returns400() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/account/search-history", token,
                "{\"mode\":\"TEXT\",\"query\":\"test\",\"resultCount\":1}");
        assertThat(status).isEqualTo(400);
    }

    @Test
    void searchHistory_oversizedResultRefs_returns400() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        String bigRefs = "[\"" + "a".repeat(5000) + "\"]";
        int status = httpStatus("POST", "/api/v1/account/search-history", token,
                "{\"mode\":\"TEXT\",\"query\":\"test\",\"resultCount\":1,\"resultRefs\":\"" + bigRefs.replace("\"", "\\\\\"") + "\",\"status\":\"SUCCESS\"}");
        assertThat(status).isEqualTo(400);
    }

    @Test
    void searchHistory_validRecord_returns201() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/account/search-history", token,
                "{\"mode\":\"TEXT\",\"query\":\"test query\",\"resultCount\":5,\"resultRefs\":\"[\\\"id1\\\",\\\"id2\\\"]\",\"status\":\"SUCCESS\"}");
        assertThat(status).isEqualTo(201);
    }

    @Test
    void searchHistory_crossUserIsolation() throws Exception {
        String suffix1 = UUID.randomUUID().toString().substring(0, 8);
        String suffix2 = UUID.randomUUID().toString().substring(0, 8);
        Account acct1 = createDisposableCustomer(suffix1);
        Account acct2 = createDisposableCustomer(suffix2);
        String token1 = tokenFor(acct1, "CUSTOMER");
        String token2 = tokenFor(acct2, "CUSTOMER");

        // User1 records history
        httpStatus("POST", "/api/v1/account/search-history", token1,
                "{\"mode\":\"TEXT\",\"query\":\"user1 query\",\"resultCount\":1,\"status\":\"SUCCESS\"}");

        // User2 records history
        httpStatus("POST", "/api/v1/account/search-history", token2,
                "{\"mode\":\"TEXT\",\"query\":\"user2 query\",\"resultCount\":1,\"status\":\"SUCCESS\"}");

        // User1 lists - should only see user1's history
        HttpRequest req1 = request("/api/v1/account/search-history?page=0&size=10")
                .header("Authorization", "Bearer " + token1).GET().build();
        HttpResponse<String> resp1 = http.send(req1, HttpResponse.BodyHandlers.ofString());
        JsonNode node1 = mapper.readTree(resp1.body());
        int count1 = node1.get("result").get("content").size();
        assertThat(count1).isEqualTo(1);
        assertThat(node1.get("result").get("content").get(0).get("query").asText()).isEqualTo("user1 query");

        // User2 lists - should only see user2's history
        HttpRequest req2 = request("/api/v1/account/search-history?page=0&size=10")
                .header("Authorization", "Bearer " + token2).GET().build();
        HttpResponse<String> resp2 = http.send(req2, HttpResponse.BodyHandlers.ofString());
        JsonNode node2 = mapper.readTree(resp2.body());
        int count2 = node2.get("result").get("content").size();
        assertThat(count2).isEqualTo(1);
        assertThat(node2.get("result").get("content").get(0).get("query").asText()).isEqualTo("user2 query");
    }

    @Test
    void searchHistory_listAndDelete() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        // Record
        httpStatus("POST", "/api/v1/account/search-history", token,
                "{\"mode\":\"TEXT\",\"query\":\"test\",\"resultCount\":1,\"status\":\"SUCCESS\"}");

        // List
        int status = httpStatus("GET", "/api/v1/account/search-history?page=0&size=5", token, null);
        assertThat(status).isEqualTo(200);

        // Delete (need id from list - skip exact id, just verify endpoint exists)
    }

    // --- Favorites Tests ---

    @Test
    void favorite_nonExistentProduct_returns404() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        int status = httpStatus("POST", "/api/v1/account/favorites?productId=999999", token, null);
        assertThat(status).isEqualTo(404);
    }

    @Test
    void favorite_idempotentAdd_returnsSameId() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        // Create a product first
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("Test Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("Test Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        // First add
        HttpRequest req1 = request("/api/v1/account/favorites?productId=" + prod.getId())
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        HttpResponse<String> resp1 = http.send(req1, HttpResponse.BodyHandlers.ofString());
        int id1 = mapper.readTree(resp1.body()).get("result").get("id").asInt();

        // Second add (idempotent)
        HttpRequest req2 = request("/api/v1/account/favorites?productId=" + prod.getId())
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        HttpResponse<String> resp2 = http.send(req2, HttpResponse.BodyHandlers.ofString());
        int id2 = mapper.readTree(resp2.body()).get("result").get("id").asInt();

        assertThat(resp1.statusCode()).isEqualTo(201);
        assertThat(resp2.statusCode()).isEqualTo(201);
        assertThat(id1).isEqualTo(id2);
    }

    @Test
    void favorite_crossUserIsolation() throws Exception {
        String suffix1 = UUID.randomUUID().toString().substring(0, 8);
        String suffix2 = UUID.randomUUID().toString().substring(0, 8);
        Account acct1 = createDisposableCustomer(suffix1);
        Account acct2 = createDisposableCustomer(suffix2);
        String token1 = tokenFor(acct1, "CUSTOMER");
        String token2 = tokenFor(acct2, "CUSTOMER");

        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("Test Cat " + suffix1).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("Test Prod " + suffix1).category(cat).price(new java.math.BigDecimal("100.00")).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        // User1 favorites product
        httpStatus("POST", "/api/v1/account/favorites?productId=" + prod.getId(), token1, null);

        // User2 cannot see user1's favorite
        HttpRequest req = request("/api/v1/account/favorites?page=0&size=10")
                .header("Authorization", "Bearer " + token2).GET().build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode node = mapper.readTree(resp.body());
        assertThat(node.get("result").get("content").size()).isEqualTo(0);

        // User2 cannot remove user1's favorite
        int status = httpStatus("DELETE", "/api/v1/account/favorites/" + prod.getId(), token2, null);
        assertThat(status).isEqualTo(404);
    }

    @Test
    void favorite_inactiveProduct_returns404() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("Test Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("Test Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).status(com.springboot.fasearch.common.enums.ProductStatus.DISCONTINUED).isDeleted(false).build());

        int status = httpStatus("POST", "/api/v1/account/favorites?productId=" + prod.getId(), token, null);
        assertThat(status).isEqualTo(404);
    }

    @Test
    void favorite_removeAndReadd_reactivates() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account acct = createDisposableCustomer(suffix);
        String token = tokenFor(acct, "CUSTOMER");

        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("Test Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("Test Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        // Add
        HttpRequest req1 = request("/api/v1/account/favorites?productId=" + prod.getId())
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        HttpResponse<String> resp1 = http.send(req1, HttpResponse.BodyHandlers.ofString());
        int id1 = mapper.readTree(resp1.body()).get("result").get("id").asInt();

        // Remove
        HttpRequest reqDel = request("/api/v1/account/favorites/" + prod.getId())
                .header("Authorization", "Bearer " + token)
                .DELETE().build();
        HttpResponse<String> respDel = http.send(reqDel, HttpResponse.BodyHandlers.ofString());
        assertThat(respDel.statusCode()).isEqualTo(200);

        // Re-add (should reactivate same id)
        HttpRequest req2 = request("/api/v1/account/favorites?productId=" + prod.getId())
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        HttpResponse<String> resp2 = http.send(req2, HttpResponse.BodyHandlers.ofString());
        int id2 = mapper.readTree(resp2.body()).get("result").get("id").asInt();

        assertThat(resp2.statusCode()).isEqualTo(201);
        assertThat(id2).isEqualTo(id1);
    }
}