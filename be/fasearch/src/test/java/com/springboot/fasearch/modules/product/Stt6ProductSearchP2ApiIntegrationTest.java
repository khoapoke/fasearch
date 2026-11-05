package com.springboot.fasearch.modules.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
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
import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.JwtProvider;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class Stt6ProductSearchP2ApiIntegrationTest {

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
    @Autowired private AccountRepository accountRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ProductRepository productRepository;

    private String baseUrl() { return "http://localhost:" + port; }

    private String adminToken() {
        Account admin = accountRepository.findByUsername("admin").orElseThrow();
        return jwtProvider.generateToken(admin.getUsername(), "ADMIN", admin.getId());
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create(baseUrl() + path));
    }

    private int httpStatus(String method, String path, String token, String body) throws Exception {
        HttpRequest.Builder b = request(path);
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpRequest.Builder rb;
        if (body != null) {
            rb = b.POST(HttpRequest.BodyPublishers.ofString(body));
        } else if (method.equals("DELETE")) {
            rb = b.DELETE();
        } else if (method.equals("POST")) {
            rb = b.POST(HttpRequest.BodyPublishers.noBody());
        } else {
            rb = b.GET();
        }
        HttpResponse<String> resp = http.send(rb.build(), HttpResponse.BodyHandlers.ofString());
        return resp.statusCode();
    }

    // Helper to build multipart body as bytes
    private static byte[] buildMultipart(String boundary, String fieldName, String fileName, String contentType, byte[] fileBytes) {
        String header = "--" + boundary + "\r\n" +
                "Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"" + fileName + "\"\r\n" +
                "Content-Type: " + contentType + "\r\n\r\n";
        String footer = "\r\n--" + boundary + "--\r\n";
        byte[] headerBytes = header.getBytes(StandardCharsets.US_ASCII);
        byte[] footerBytes = footer.getBytes(StandardCharsets.US_ASCII);
        byte[] body = new byte[headerBytes.length + fileBytes.length + footerBytes.length];
        System.arraycopy(headerBytes, 0, body, 0, headerBytes.length);
        System.arraycopy(fileBytes, 0, body, headerBytes.length, fileBytes.length);
        System.arraycopy(footerBytes, 0, body, headerBytes.length + fileBytes.length, footerBytes.length);
        return body;
    }

    private static byte[] makePng() {
        // Valid 1x1 red PNG (69 bytes), generated by ImageIO
        return new byte[]{
            (byte)0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
            0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,(byte)0x90,0x77,0x53,(byte)0xDE,
            0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54,0x78,(byte)0x5E,0x63,(byte)0xF8,(byte)0xCF,(byte)0xC0,0x00,0x00,0x03,0x01,0x01,0x00,0x30,0x3B,0x07,0x5E,
            0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,(byte)0xAE,0x42,0x60,(byte)0x82
        };
    }

    private static byte[] concat(byte[]... arrays) {
        int total = 0;
        for (byte[] a : arrays) total += a.length;
        byte[] result = new byte[total];
        int pos = 0;
        for (byte[] a : arrays) { System.arraycopy(a, 0, result, pos, a.length); pos += a.length; }
        return result;
    }

    @Test
    void uploadValidImage_returns200() throws Exception {
        String token = adminToken();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("P2Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("P2Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).publicationStatus(com.springboot.fasearch.modules.publish.entity.PublicationStatus.DRAFT).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        byte[] png = makePng();
        String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        byte[] body = buildMultipart(boundary, "file", "test.png", "image/png", png);
        HttpRequest req = request("/api/v1/products/" + prod.getId() + "/image")
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(200);
    }

    @Test
    void uploadCorruptImage_returns400() throws Exception {
        String token = adminToken();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("P2Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("P2Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).publicationStatus(com.springboot.fasearch.modules.publish.entity.PublicationStatus.DRAFT).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        byte[] corrupt = new byte[]{(byte)0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00};
        String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        byte[] body = buildMultipart(boundary, "file", "corrupt.png", "image/png", corrupt);
        HttpRequest req = request("/api/v1/products/" + prod.getId() + "/image")
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(400);
    }

    @Test
    void uploadDotlessFilename_returns400() throws Exception {
        String token = adminToken();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("P2Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("P2Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).publicationStatus(com.springboot.fasearch.modules.publish.entity.PublicationStatus.DRAFT).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        byte[] png = makePng();
        String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        byte[] body = buildMultipart(boundary, "file", "noext", "image/png", png);
        HttpRequest req = request("/api/v1/products/" + prod.getId() + "/image")
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(400);
    }

    @Test
    void uploadNonexistentProduct_returns404() throws Exception {
        String token = adminToken();
        byte[] png = makePng();
        String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        byte[] body = buildMultipart(boundary, "file", "test.png", "image/png", png);
        HttpRequest req = request("/api/v1/products/999999/image")
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(404);
    }

    @Test
    void uploadUnauthorized_returns401() throws Exception {
        byte[] png = makePng();
        String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        byte[] body = buildMultipart(boundary, "file", "test.png", "image/png", png);
        HttpRequest req = request("/api/v1/products/1/image")
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(401);
    }

    @Test
    void serveImage_returns200() throws Exception {
        String token = adminToken();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("P2Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("P2Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).publicationStatus(com.springboot.fasearch.modules.publish.entity.PublicationStatus.DRAFT).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        byte[] png = makePng();
        String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        byte[] body = buildMultipart(boundary, "file", "test.png", "image/png", png);
        HttpRequest req = request("/api/v1/products/" + prod.getId() + "/image")
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(200);
        String url = mapper.readTree(resp.body()).get("result").asText();

        HttpRequest serveReq = request(url).GET().build();
        HttpResponse<byte[]> serveResp = http.send(serveReq, HttpResponse.BodyHandlers.ofByteArray());
        assertThat(serveResp.statusCode()).isEqualTo(200);
    }

    @Test
    void removeImage_returns200() throws Exception {
        String token = adminToken();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("P2Cat " + suffix).isDeleted(false).build());
        Product prod = productRepository.saveAndFlush(Product.builder().productName("P2Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).publicationStatus(com.springboot.fasearch.modules.publish.entity.PublicationStatus.DRAFT).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        byte[] png = makePng();
        String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        byte[] body = buildMultipart(boundary, "file", "test.png", "image/png", png);
        HttpRequest req = request("/api/v1/products/" + prod.getId() + "/image")
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        http.send(req, HttpResponse.BodyHandlers.ofString());

        HttpRequest delReq = request("/api/v1/products/" + prod.getId() + "/image")
                .header("Authorization", "Bearer " + token).DELETE().build();
        HttpResponse<String> delResp = http.send(delReq, HttpResponse.BodyHandlers.ofString());
        assertThat(delResp.statusCode()).isEqualTo(200);
    }

    @Test
    void deleteCategoryWithReferencedProducts_returns400() throws Exception {
        String token = adminToken();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("P2Cat " + suffix).isDeleted(false).build());
        productRepository.saveAndFlush(Product.builder().productName("P2Prod " + suffix).category(cat).price(new java.math.BigDecimal("100.00")).publicationStatus(com.springboot.fasearch.modules.publish.entity.PublicationStatus.DRAFT).status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE).isDeleted(false).build());

        int status = httpStatus("DELETE", "/api/v1/categories/" + cat.getId(), token, null);
        assertThat(status).isEqualTo(400);
    }

    @Test
    void deleteCategoryWithoutProducts_returns200() throws Exception {
        String token = adminToken();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("P2EmptyCat " + suffix).isDeleted(false).build());

        int status = httpStatus("DELETE", "/api/v1/categories/" + cat.getId(), token, null);
        assertThat(status).isEqualTo(200);
    }
}