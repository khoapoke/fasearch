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
 * Phiếu nhập kho nhiều dòng: POST /api/v1/inventory/import-receipts với >= 2 SKU khác nhau.
 *
 * <p>Chạy trên PostgreSQL thật (container ephemeral do lane BE dựng riêng, vì PG dùng chung
 * 55732 đã hết max_connections bởi các service cũ phải giữ nguyên). Không mock repository,
 * không H2: mọi khẳng định về phiếu/chi tiết/tồn kho đều đọc lại từ DB.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ImportReceiptMultiLineIntegrationTest {

    /**
     * PostgreSQL thật: container tạm của lane BE (fasearch-demo-integrated-testpg, cổng 55440),
     * DB demo riêng. Thông tin đăng nhập lấy từ biến môi trường (không hard-code secret trong Git).
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
    /** Hậu tố duy nhất mỗi lần chạy: DB test không reset giữa các lần nên tránh đụng unique key. */
    private String uniq;
    private String supplierMulti;
    private String supplierSingle;
    private String supplierRollback;
    private String supplierList;

    @BeforeEach
    void setUp() {
        uniq = Long.toString(System.nanoTime(), 36);
        supplierMulti = "NCC Multi " + uniq;
        supplierSingle = "NCC Single " + uniq;
        supplierRollback = "NCC Rollback " + uniq;
        supplierList = "NCC List " + uniq;
        adminToken = jwtProvider.generateToken("admin", "ADMIN", 1L);

        Category category = categoryRepository.save(Category.builder()
                .categoryName("DM nhap kho " + uniq).isDeleted(false).build());
        Product product = productRepository.save(Product.builder()
                .productName("SP nhap nhieu dong " + uniq)
                .category(category)
                .price(new BigDecimal("150000.00"))
                .build());
        skuA = variantRepository.save(ProductVariant.builder()
                .product(product).color("Den").size("M")
                .barcode("IMPFIX-A-" + uniq).isDeleted(false).build()).getId();
        skuB = variantRepository.save(ProductVariant.builder()
                .product(product).color("Trang").size("L")
                .barcode("IMPFIX-B-" + uniq).isDeleted(false).build()).getId();
        // SKU A có sẵn tồn kho với lượng đang giữ > 0: nhập thêm không được đổi reserved.
        inventoryRepository.save(Inventory.builder()
                .variant(variantRepository.findById(skuA).orElseThrow())
                .physicalStock(5).reservedStock(2).availableStock(3).minThreshold(10)
                .isDeleted(false).build());
    }

    // ---------------------------------------------------------------- helpers

    private record Resp(int status, String body) {
        boolean is2xx() {
            return status >= 200 && status < 300;
        }
    }

    /** HTTP thật tới server test (JDK HttpClient: không thêm dependency nào). */
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

    private Resp postImport(String body) {
        return call("POST", "/api/v1/inventory/import-receipts", body, adminToken);
    }

    private String twoLineBody(String supplier) {
        return """
                {"supplierName":"%s","note":"nhap 2 SKU",
                 "items":[{"skuId":%d,"quantity":3,"importPrice":100000},
                          {"skuId":%d,"quantity":7,"importPrice":50000}]}
                """.formatted(supplier, skuA, skuB);
    }

    // ---------------------------------------------------------------- tests

    @Test
    @DisplayName("Hai SKU khác nhau: 201, một phiếu, đủ dòng, đúng tiền, tồn kho tăng theo dòng")
    void multiLine_haiSkuKhacNhau() {
        Resp response = postImport(twoLineBody(supplierMulti));
        assertThat(response.status())
                .as("POST nhiều dòng phải trả 201, body=%s", response.body())
                .isEqualTo(201);

        Map<String, Object> receipt = jdbc.queryForMap(
                "SELECT ma_phieu_nhap, trang_thai, tong_so_luong, tong_tien FROM phieu_nhap_kho "
                        + "WHERE nha_cung_cap = ?", supplierMulti);
        Long receiptId = ((Number) receipt.get("ma_phieu_nhap")).longValue();
        assertThat(receipt.get("trang_thai")).isEqualTo("COMPLETED");
        assertThat(((Number) receipt.get("tong_so_luong")).intValue()).isEqualTo(10);
        assertThat((BigDecimal) receipt.get("tong_tien")).isEqualByComparingTo("650000.00");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM ct_phieu_nhap WHERE ma_phieu_nhap = ?", Integer.class, receiptId))
                .as("phiếu phải có đúng 2 dòng chi tiết").isEqualTo(2);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM phieu_nhap_kho WHERE nha_cung_cap = ?", Integer.class,
                supplierMulti)).as("không được tạo nhiều phiếu").isEqualTo(1);

        Map<String, Object> stockA = jdbc.queryForMap(
                "SELECT so_luong_vat_ly, so_luong_tam_giu, so_luong_kha_dung FROM ton_kho WHERE ma_sku = ?",
                skuA);
        assertThat(((Number) stockA.get("so_luong_vat_ly")).intValue()).isEqualTo(8);
        assertThat(((Number) stockA.get("so_luong_tam_giu")).intValue())
                .as("reserved không đổi").isEqualTo(2);
        assertThat(((Number) stockA.get("so_luong_kha_dung")).intValue()).isEqualTo(6);
        Map<String, Object> stockB = jdbc.queryForMap(
                "SELECT so_luong_vat_ly, so_luong_tam_giu, so_luong_kha_dung FROM ton_kho WHERE ma_sku = ?",
                skuB);
        assertThat(((Number) stockB.get("so_luong_vat_ly")).intValue()).isEqualTo(7);
        assertThat(((Number) stockB.get("so_luong_tam_giu")).intValue()).isZero();
        assertThat(((Number) stockB.get("so_luong_kha_dung")).intValue()).isEqualTo(7);

        Resp detail = call("GET", "/api/v1/inventory/import-receipts/" + receiptId, null, adminToken);
        assertThat(detail.status()).isEqualTo(200);
        assertThat(detail.body()).as("chi tiết phiếu phải còn đủ dòng sau khi reload")
                .contains("IMPFIX").doesNotContain("\"items\":[]");
    }

    @Test
    @DisplayName("Một dòng vẫn hoạt động (không hồi quy)")
    void singleLine_vanHoatDong() {
        Resp response = postImport("""
                {"supplierName":"%s","items":[{"skuId":%d,"quantity":4,"importPrice":25000}]}
                """.formatted(supplierSingle, skuB));
        assertThat(response.status()).as("body=%s", response.body()).isEqualTo(201);
        assertThat(jdbc.queryForObject(
                "SELECT so_luong_vat_ly FROM ton_kho WHERE ma_sku = ?", Integer.class, skuB))
                .isEqualTo(4);
    }

    @Test
    @DisplayName("SKU thứ hai không hợp lệ: rollback toàn bộ, không phiếu/dòng/tồn kho dở dang")
    void skuSauKhongHopLe_rollbackToanBo() {
        int receiptsBefore = jdbc.queryForObject("SELECT count(*) FROM phieu_nhap_kho", Integer.class);
        int detailsBefore = jdbc.queryForObject("SELECT count(*) FROM ct_phieu_nhap", Integer.class);

        Resp response = postImport("""
                {"supplierName":"%s",
                 "items":[{"skuId":%d,"quantity":2,"importPrice":10000},
                          {"skuId":999999999,"quantity":1,"importPrice":10000}]}
                """.formatted(supplierRollback, skuA));
        assertThat(response.is2xx()).as("phải thất bại, body=%s", response.body()).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM phieu_nhap_kho", Integer.class))
                .as("không được để lại phiếu").isEqualTo(receiptsBefore);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM ct_phieu_nhap", Integer.class))
                .as("không được để lại dòng chi tiết").isEqualTo(detailsBefore);
        assertThat(jdbc.queryForObject(
                "SELECT so_luong_vat_ly FROM ton_kho WHERE ma_sku = ?", Integer.class, skuA))
                .as("tồn kho SKU hợp lệ không được tăng khi phiếu rollback").isEqualTo(5);
    }

    @Test
    @DisplayName("Danh sách phiếu nhập trả về được và lọc theo nhà cung cấp")
    void danhSachPhieuNhap() {
        Resp created = postImport("""
                {"supplierName":"%s","items":[{"skuId":%d,"quantity":1,"importPrice":1000}]}
                """.formatted(supplierList, skuB));
        assertThat(created.status()).as("body=%s", created.body()).isEqualTo(201);

        Resp list = call("GET", "/api/v1/inventory/import-receipts?page=0&size=10&supplierName="
                + supplierList.replace(" ", "%20"), null, adminToken);
        assertThat(list.status()).isEqualTo(200);
        assertThat(list.body()).contains(supplierList);
    }

    @Test
    @DisplayName("Không token bị chặn; STAFF (Quản lý) tạo được phiếu nhập; STAFF không được tạo tài khoản")
    void phanQuyen() {
        Resp anonymous = call("POST", "/api/v1/inventory/import-receipts", "{}", null);
        assertThat(anonymous.is2xx()).as("không token thì không được tạo").isFalse();

        // STAFF = Quản lý: được tạo phiếu nhập (role-manager-20261105); chỉ ADMIN quản lý tài khoản/vai trò.
        String staffSupplier = "NCC Staff " + uniq;
        String staffToken = jwtProvider.generateToken("nhanvien1", "STAFF", 2L);
        Resp staffPost = call("POST", "/api/v1/inventory/import-receipts", """
                {"supplierName":"%s","items":[{"skuId":%d,"quantity":1,"importPrice":1000}]}
                """.formatted(staffSupplier, skuB), staffToken);
        assertThat(staffPost.status()).as("STAFF được tạo phiếu nhập, body=%s", staffPost.body()).isEqualTo(201);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM phieu_nhap_kho WHERE nha_cung_cap = ?", Integer.class,
                staffSupplier)).as("phiếu của STAFF được lưu").isEqualTo(1);

        Resp staffAccount = call("POST", "/api/v1/auth/accounts", "{}", staffToken);
        assertThat(staffAccount.status()).as("STAFF không được tạo tài khoản đăng nhập").isEqualTo(403);
    }
}
