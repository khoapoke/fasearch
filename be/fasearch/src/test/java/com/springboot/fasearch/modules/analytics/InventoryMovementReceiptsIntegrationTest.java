package com.springboot.fasearch.modules.analytics;

import static org.assertj.core.api.Assertions.assertThat;


import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.security.JwtProvider;

/**
 * Báo cáo xuất-nhập-tồn: Nhập và Hỏng lấy từ phiếu thật (COMPLETED) của tháng; Xuất (bán) chỉ từ hóa đơn.
 * Chạy trên PostgreSQL tạm (DEMO_TEST_DB_*), không mock repository.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class InventoryMovementReceiptsIntegrationTest {

    /**
     * PostgreSQL thật: container tạm của lane BE (fasearch-demo-integrated-testpg, cổng 55440), DB demo riêng
     * để không đụng DB pilot mà FE dùng. Thông tin đăng nhập lấy từ biến môi trường (không hard-code
     * secret trong Git).
     */
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
    @Autowired
    private ProductVariantRepository variantRepository;
    @Autowired
    private InventoryRepository inventoryRepository;

    private String adminToken;
    private Long skuA;
    private Long skuB;
    private String uniq;

    @BeforeEach
    void setUp() {
        uniq = Long.toString(System.nanoTime(), 36);
        adminToken = jwtProvider.generateToken("admin", "ADMIN", 1L);

        Category category = categoryRepository.save(Category.builder()
                .categoryName("DM xnt " + uniq).isDeleted(false).build());
        Product product = productRepository.save(Product.builder()
                .productName("SP xnt " + uniq)
                .category(category)
                .price(new BigDecimal("150000.00"))
                .build());
        skuA = variantRepository.save(ProductVariant.builder()
                .product(product).color("Den").size("M")
                .barcode("XNTFIX-A-" + uniq).isDeleted(false).build()).getId();
        skuB = variantRepository.save(ProductVariant.builder()
                .product(product).color("Trang").size("L")
                .barcode("XNTFIX-B-" + uniq).isDeleted(false).build()).getId();
        // SKU A: vật lý 10, đang giữ 2, khả dụng 8 (giữ nguyên reserved khi xuất).
        inventoryRepository.save(Inventory.builder()
                .variant(variantRepository.findById(skuA).orElseThrow())
                .physicalStock(10).reservedStock(2).availableStock(8).minThreshold(10)
                .isDeleted(false).build());
        // SKU B: vật lý 10, không giữ, khả dụng 10.
        inventoryRepository.save(Inventory.builder()
                .variant(variantRepository.findById(skuB).orElseThrow())
                .physicalStock(10).reservedStock(0).availableStock(10).minThreshold(10)
                .isDeleted(false).build());
    }

    // ---------------------------------------------------------------- helpers

    private record Resp(int status, String body) {
    }

    private Resp call(String method, String path, String body) {
        try {
            HttpRequest.Builder builder = HttpRequest
                    .newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + adminToken);
            builder.method(method, body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body));
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            return new Resp(response.statusCode(), response.body());
        } catch (Exception ex) {
            throw new IllegalStateException("HTTP call failed: " + method + " " + path, ex);
        }
    }

    private JsonNode row(Long sku) throws Exception {
        java.time.YearMonth now = java.time.YearMonth.now();
        Resp r = call("GET", "/api/v1/analytics/inventory-movement?year=" + now.getYear()
                + "&month=" + now.getMonthValue() + "&sku=" + sku + "&page=0&size=10", null);
        assertThat(r.status()).as(r.body()).isEqualTo(200);
        JsonNode content = new ObjectMapper().readTree(r.body()).path("result").path("content");
        assertThat(content.size()).as(r.body()).isEqualTo(1);
        return content.get(0);
    }

    @Test
    @DisplayName("Nhập 5 và xuất hỏng 3 trong tháng: Nhập=5, Hỏng=3, Tồn đầu null, Bán không đổi; phiếu hủy và phiếu tháng khác không tính")
    void importAndDamagedComeFromCompletedReceipts() throws Exception {
        assertThat(call("POST", "/api/v1/inventory/import-receipts", """
                {"supplierName":"NCC %s","items":[{"skuId":%d,"quantity":5,"importPrice":100000}]}
                """.formatted(uniq, skuA)).status()).isEqualTo(201);
        assertThat(call("POST", "/api/v1/inventory/export-receipts", """
                {"exportType":"DAMAGED","items":[{"skuId":%d,"quantity":3,"reason":"hong"}]}
                """.formatted(skuA)).status()).isEqualTo(201);
        // A non-damaged export must not count as Hỏng.
        assertThat(call("POST", "/api/v1/inventory/export-receipts", """
                {"exportType":"OTHER","items":[{"skuId":%d,"quantity":1,"reason":"mau"}]}
                """.formatted(skuA)).status()).isEqualTo(201);

        JsonNode a = row(skuA);
        assertThat(a.path("totalImport").asLong()).isEqualTo(5);
        assertThat(a.path("totalDamaged").asLong()).isEqualTo(3);
        assertThat(a.path("totalSold").asLong()).isZero();
        assertThat(a.path("openingStock").isNull()).isTrue();
        assertThat(a.path("closingStock").asLong()).as("khả dụng hiện tại 8+5-3-1").isEqualTo(9);

        // Cancelled receipts and receipts of another month are ignored.
        jdbc.update("UPDATE phieu_nhap_kho SET trang_thai = 'CANCELLED'");
        assertThat(row(skuA).path("totalImport").asLong()).isZero();
        jdbc.update("UPDATE phieu_nhap_kho SET trang_thai = 'COMPLETED', ngay_tao = ngay_tao - interval '40 days'");
        assertThat(row(skuA).path("totalImport").asLong()).isZero();
        jdbc.update("UPDATE phieu_xuat_kho SET ngay_tao = ngay_tao + interval '40 days' WHERE loai_xuat = 'DAMAGED'");
        assertThat(row(skuA).path("totalDamaged").asLong()).isZero();

        // The other SKU of the page had no receipts: explicit zero, not null.
        JsonNode b = row(skuB);
        assertThat(b.path("totalImport").asLong()).isZero();
        assertThat(b.path("totalDamaged").asLong()).isZero();
    }
}
