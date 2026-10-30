package com.springboot.fasearch.modules.inventory;

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
 * Phiếu xuất kho nhiều dòng: POST /api/v1/inventory/export-receipts với >= 2 SKU khác nhau.
 *
 * <p>Chạy trên PostgreSQL thật (container tạm của lane BE, DB test riêng để không đụng DB pilot
 * mà FE dùng cho journey). Không mock repository, không H2: mọi khẳng định về phiếu/chi tiết/
 * tồn kho đều đọc lại từ DB.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ExportReceiptMultiLineIntegrationTest {

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
        adminToken = jwtProvider.generateToken("admin-exportfix", "ADMIN", 1L);

        Category category = categoryRepository.save(Category.builder()
                .categoryName("DM xuat kho " + uniq).isDeleted(false).build());
        Product product = productRepository.save(Product.builder()
                .productName("SP xuat nhieu dong " + uniq)
                .category(category)
                .price(new BigDecimal("150000.00"))
                .build());
        skuA = variantRepository.save(ProductVariant.builder()
                .product(product).color("Den").size("M")
                .barcode("EXPFIX-A-" + uniq).isDeleted(false).build()).getId();
        skuB = variantRepository.save(ProductVariant.builder()
                .product(product).color("Trang").size("L")
                .barcode("EXPFIX-B-" + uniq).isDeleted(false).build()).getId();
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
        boolean is2xx() {
            return status >= 200 && status < 300;
        }
    }

    private Resp call(String method, String path, String body, String token) {
        try {
            HttpRequest.Builder builder = HttpRequest
                    .newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Content-Type", "application/json");
            if (token != null) {
                builder.header("Authorization", "Bearer " + token);
            }
            builder.method(method, body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body));
            HttpResponse<String> response =
                    http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            return new Resp(response.statusCode(), response.body());
        } catch (Exception ex) {
            throw new IllegalStateException("HTTP call failed: " + method + " " + path, ex);
        }
    }

    private Resp postExport(String body) {
        return call("POST", "/api/v1/inventory/export-receipts", body, adminToken);
    }

    private String twoLineNote() {
        return "xuat 2 SKU " + uniq;
    }

    private String twoLineBody(String reason) {
        return """
                {"exportType":"DAMAGED","note":"%s",
                 "items":[{"skuId":%d,"quantity":2,"reason":"%s"},
                          {"skuId":%d,"quantity":3,"reason":"%s"}]}
                """.formatted(twoLineNote(), skuA, reason, skuB, reason);
    }

    private String stock(Long sku) {
        return jdbc.queryForObject(
                "SELECT so_luong_vat_ly||'/'||so_luong_tam_giu||'/'||so_luong_kha_dung "
                        + "FROM ton_kho WHERE ma_sku = ?", String.class, sku);
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    // ---------------------------------------------------------------- tests

    @Test
    @DisplayName("Hai SKU khác nhau: 201, một phiếu COMPLETED, đủ dòng, trừ kho đúng, reserved nguyên")
    void multiLine_haiSkuKhacNhau() {
        String reason = "Hang loi " + uniq;
        Resp response = postExport(twoLineBody(reason));
        assertThat(response.status())
                .as("POST xuất nhiều dòng phải trả 201, body=%s", response.body())
                .isEqualTo(201);

        Map<String, Object> receipt = jdbc.queryForMap(
                "SELECT ma_phieu_xuat, trang_thai, tong_so_luong FROM phieu_xuat_kho WHERE ghi_chu = ?",
                twoLineNote());
        Long receiptId = ((Number) receipt.get("ma_phieu_xuat")).longValue();
        assertThat(receipt.get("trang_thai")).isEqualTo("COMPLETED");
        assertThat(((Number) receipt.get("tong_so_luong")).intValue()).isEqualTo(5);
        assertThat(count("SELECT count(*) FROM ct_phieu_xuat WHERE ma_phieu_xuat = ?", receiptId))
                .as("phiếu phải có đúng 2 dòng chi tiết").isEqualTo(2);

        assertThat(stock(skuA)).as("SKU A: 10-2=8, giữ nguyên 2, khả dụng 6").isEqualTo("8/2/6");
        assertThat(stock(skuB)).as("SKU B: 10-3=7, giữ 0, khả dụng 7").isEqualTo("7/0/7");

        Resp detail = call("GET", "/api/v1/inventory/export-receipts/" + receiptId, null, adminToken);
        assertThat(detail.status()).isEqualTo(200);
        assertThat(detail.body()).as("chi tiết còn đủ dòng sau reload")
                .contains("EXPFIX").doesNotContain("\"items\":[]");
    }

    @Test
    @DisplayName("Một dòng vẫn hoạt động (không hồi quy)")
    void singleLine_vanHoatDong() {
        Resp response = postExport("""
                {"exportType":"OTHER","items":[{"skuId":%d,"quantity":4,"reason":"mau thu"}]}
                """.formatted(skuB));
        assertThat(response.status()).as("body=%s", response.body()).isEqualTo(201);
        assertThat(stock(skuB)).as("10-4=6").isEqualTo("6/0/6");
    }

    @Test
    @DisplayName("Vượt khả dụng (dù đủ vật lý) bị từ chối, không đổi tồn kho")
    void vuotKhaDung_biTuChoi() {
        // SKU A: vật lý 10 nhưng khả dụng 8 (đang giữ 2) -> xin 9 phải bị chặn.
        int receiptsBefore = count("SELECT count(*) FROM phieu_xuat_kho");
        Resp response = postExport("""
                {"exportType":"DAMAGED","items":[{"skuId":%d,"quantity":9,"reason":"vuot kha dung"}]}
                """.formatted(skuA));
        assertThat(response.is2xx()).as("phải bị từ chối, body=%s", response.body()).isFalse();
        assertThat(stock(skuA)).as("tồn kho không đổi").isEqualTo("10/2/8");
        assertThat(count("SELECT count(*) FROM phieu_xuat_kho")).isEqualTo(receiptsBefore);
    }

    @Test
    @DisplayName("SKU thứ hai không tồn tại: rollback, không phiếu/dòng/tồn kho dở dang")
    void skuSauKhongHopLe_rollbackToanBo() {
        int receiptsBefore = count("SELECT count(*) FROM phieu_xuat_kho");
        int detailsBefore = count("SELECT count(*) FROM ct_phieu_xuat");
        Resp response = postExport("""
                {"exportType":"DAMAGED",
                 "items":[{"skuId":%d,"quantity":2,"reason":"dong 1"},
                          {"skuId":999999999,"quantity":1,"reason":"dong 2"}]}
                """.formatted(skuA));
        assertThat(response.is2xx()).as("phải thất bại, body=%s", response.body()).isFalse();
        assertThat(count("SELECT count(*) FROM phieu_xuat_kho")).isEqualTo(receiptsBefore);
        assertThat(count("SELECT count(*) FROM ct_phieu_xuat")).isEqualTo(detailsBefore);
        assertThat(stock(skuA)).as("tồn kho SKU hợp lệ không bị trừ khi rollback").isEqualTo("10/2/8");
    }

    @Test
    @DisplayName("Cùng SKU lặp lại vượt khả dụng: cộng gộp rồi từ chối")
    void trungSku_congGopRoiTuChoi() {
        // 5 + 5 = 10 > khả dụng 8 của SKU A.
        Resp response = postExport("""
                {"exportType":"DAMAGED",
                 "items":[{"skuId":%d,"quantity":5,"reason":"lan 1"},
                          {"skuId":%d,"quantity":5,"reason":"lan 2"}]}
                """.formatted(skuA, skuA));
        assertThat(response.is2xx()).as("phải bị từ chối, body=%s", response.body()).isFalse();
        assertThat(stock(skuA)).as("tồn kho không đổi").isEqualTo("10/2/8");
    }

    @Test
    @DisplayName("Số lượng 0 hoặc âm bị validation chặn (400), không hiệu ứng")
    void soLuongKhongHopLe_400() {
        int receiptsBefore = count("SELECT count(*) FROM phieu_xuat_kho");
        for (int qty : new int[]{0, -3}) {
            Resp response = postExport("""
                    {"exportType":"DAMAGED","items":[{"skuId":%d,"quantity":%d,"reason":"am"}]}
                    """.formatted(skuB, qty));
            assertThat(response.status()).as("quantity=%d phải 400", qty).isEqualTo(400);
        }
        assertThat(count("SELECT count(*) FROM phieu_xuat_kho")).isEqualTo(receiptsBefore);
        assertThat(stock(skuB)).isEqualTo("10/0/10");
    }

    @Test
    @DisplayName("Không token bị chặn; STAFF không POST được và không tạo phiếu; STAFF đọc được")
    void phanQuyen() {
        Resp anonymous = call("POST", "/api/v1/inventory/export-receipts", twoLineBody("anon"), null);
        assertThat(anonymous.is2xx()).as("không token thì không được tạo").isFalse();

        String staffToken = jwtProvider.generateToken("staff-exportfix", "STAFF", 2L);
        String staffNote = "staff note " + uniq;
        Resp staffPost = call("POST", "/api/v1/inventory/export-receipts", """
                {"exportType":"DAMAGED","note":"%s",
                 "items":[{"skuId":%d,"quantity":1,"reason":"staff"}]}
                """.formatted(staffNote, skuB), staffToken);
        assertThat(staffPost.is2xx()).as("STAFF không được tạo phiếu xuất").isFalse();
        assertThat(count("SELECT count(*) FROM phieu_xuat_kho WHERE ghi_chu = ?", staffNote))
                .as("STAFF không tạo được phiếu nào trong DB").isZero();

        Resp staffRead = call("GET", "/api/v1/inventory/export-receipts?page=0&size=5", null, staffToken);
        assertThat(staffRead.status()).as("STAFF được đọc danh sách").isEqualTo(200);
    }

    @Test
    @DisplayName("Không hồi quy: phiếu nhập nhiều dòng vẫn 201 sau khi sửa phiếu xuất")
    void importNhieuDong_vanHoatDong() {
        Resp response = call("POST", "/api/v1/inventory/import-receipts", """
                {"supplierName":"NCC nonregress %s",
                 "items":[{"skuId":%d,"quantity":1,"importPrice":100000},
                          {"skuId":%d,"quantity":2,"importPrice":50000}]}
                """.formatted(uniq, skuA, skuB), adminToken);
        assertThat(response.status()).as("import nhiều dòng vẫn phải 201, body=%s", response.body())
                .isEqualTo(201);
        assertThat(stock(skuA)).as("SKU A nhập 1: 10+1=11, giữ 2, khả dụng 9").isEqualTo("11/2/9");
        assertThat(stock(skuB)).as("SKU B nhập 2: 10+2=12, khả dụng 12").isEqualTo("12/0/12");
    }
}
