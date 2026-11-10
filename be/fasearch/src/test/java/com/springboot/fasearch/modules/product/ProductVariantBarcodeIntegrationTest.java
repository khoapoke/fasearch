package com.springboot.fasearch.modules.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.security.JwtProvider;

/**
 * Mã vạch SKU tự sinh: màu/kích cỡ tiếng Việt ("Đen") từng làm bộ sinh mã vạch ném
 * IllegalArgumentException (Code128 chỉ nhận ASCII) → HTTP 500 ở màn hình Admin.
 *
 * <p>PostgreSQL thật (container tạm của lane BE), HTTP thật, không mock repository.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProductVariantBarcodeIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String host = env("DEMO_TEST_DB_HOST", "127.0.0.1");
        String port = env("DEMO_TEST_DB_PORT", "55440");
        String name = env("DEMO_TEST_DB_NAME", "fasearch_demo_integrated_20261030");
        registry.add("spring.datasource.url",
                () -> "jdbc:postgresql://" + host + ":" + port + "/" + name);
        registry.add("spring.datasource.username", () -> env("DEMO_TEST_DB_USER", "fasearch"));
        registry.add("spring.datasource.password", () -> env("DEMO_TEST_DB_PASSWORD", ""));
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    @LocalServerPort
    private int port;
    private final HttpClient http = HttpClient.newHttpClient();

    @Autowired
    private JwtProvider jwtProvider;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private ProductRepository productRepository;

    private String adminToken;
    private Long productId;
    private String uniq;

    @BeforeEach
    void setUp() {
        uniq = Long.toString(System.nanoTime(), 36);
        adminToken = jwtProvider.generateToken("admin", "ADMIN", 1L);
        Category category = categoryRepository.save(Category.builder()
                .categoryName("DM barcode " + uniq).isDeleted(false).build());
        productId = productRepository.save(Product.builder()
                .productName("SP barcode " + uniq)
                .category(category)
                .price(new BigDecimal("150000.00"))
                .build()).getId();
    }

    private record Resp(int status, String body, byte[] raw) {
    }

    private Resp call(String method, String path, String json) {
        try {
            HttpRequest.Builder builder = HttpRequest
                    .newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + adminToken);
            builder.method(method, json == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(json));
            HttpResponse<byte[]> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            return new Resp(response.statusCode(), new String(response.body()), response.body());
        } catch (Exception ex) {
            throw new IllegalStateException("HTTP call failed: " + method + " " + path, ex);
        }
    }

    @Test
    @DisplayName("SKU màu tiếng Việt: mã vạch ASCII, GET barcode 200 (không 500), ảnh PNG thật")
    void maVachTuDong_khongLoiTiengViet() {
        Resp created = call("POST", "/api/v1/products/" + productId + "/variants",
                """
                        {"color":"Đen","size":"M"}
                        """);
        assertThat(created.status()).as("tạo SKU: %s", created.body()).isEqualTo(201);

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT ma_sku, ma_vach FROM bien_the_sp WHERE ma_sp = ? AND mau_sac = ? AND kich_co = ?",
                productId, "Đen", "M");
        Long skuId = ((Number) row.get("ma_sku")).longValue();
        String barcode = (String) row.get("ma_vach");
        assertThat(barcode).as("mã vạch phải sinh ASCII, bỏ dấu Đ").matches("[A-Za-z0-9-]+");
        assertThat(barcode).doesNotContain("Đ");

        Resp info = call("GET", "/api/v1/products/variants/" + skuId + "/barcode", null);
        assertThat(info.status()).as("GET barcode không được 500: %s", info.body()).isEqualTo(200);
        assertThat(info.body()).contains("\"barcode\"").contains("data:image/png;base64,");

        Resp image = call("GET", "/api/v1/products/variants/" + skuId + "/barcode/image", null);
        assertThat(image.status()).isEqualTo(200);
        assertThat(image.raw()[0] & 0xFF).as("PNG magic").isEqualTo(0x89);
    }

    @Test
    @DisplayName("SKU có mã vạch cũ chứa ký tự tiếng Việt: GET tự sinh lại ASCII, không 500")
    void maVachCuKhongAscii_tuSinhLai() {
        Resp created = call("POST", "/api/v1/products/" + productId + "/variants",
                """
                        {"color":"Trắng","size":"L"}
                        """);
        assertThat(created.status()).isEqualTo(201);
        Long skuId = ((Number) jdbc.queryForMap(
                "SELECT ma_sku FROM bien_the_sp WHERE ma_sp = ? AND mau_sac = ? AND kich_co = ?",
                productId, "Trắng", "L").get("ma_sku")).longValue();
        // Mô phỏng dữ liệu cũ: mã vạch chứa ký tự tiếng Việt đã lưu trước đây.
        jdbc.update("UPDATE bien_the_sp SET ma_vach = ? WHERE ma_sku = ?", "SP0001-ĐEN-M", skuId);

        Resp info = call("GET", "/api/v1/products/variants/" + skuId + "/barcode", null);
        assertThat(info.status()).as("phải tự sinh lại, không 500: %s", info.body()).isEqualTo(200);
        String fixed = jdbc.queryForObject("SELECT ma_vach FROM bien_the_sp WHERE ma_sku = ?",
                String.class, skuId);
        assertThat(fixed).matches("[A-Za-z0-9-]+").doesNotContain("Đ");
    }
}
