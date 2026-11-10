package com.springboot.fasearch.modules.review;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.entity.OrderDetailId;
import com.springboot.fasearch.modules.order.repository.OrderDetailRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.JwtProvider;

/**
 * IT đánh giá sản phẩm: PostgreSQL thật + HTTP thật (scripts/it-db/run-it.sh, biến PROMOTION_TEST_DB_*).
 * Quy tắc: chỉ khách có đơn COMPLETED chứa sản phẩm mới được đánh giá; mỗi khách một đánh giá / sản phẩm;
 * ẩn bởi ADMIN/Quản lý; public đọc không cần đăng nhập.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProductReviewApiIntegrationTest {

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
    @Autowired private UserRepository customerRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ProductVariantRepository variantRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderDetailRepository orderDetailRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtProvider jwtProvider;
    @Autowired private JdbcTemplate jdbc;

    private String uniq;
    private Long productId;
    private Long otherProductId;
    private Account buyer;
    private String buyerToken;
    private String strangerToken;
    private String adminToken;
    private ProductVariant variant;

    @BeforeEach
    void setUp() {
        uniq = Long.toString(System.nanoTime(), 36);
        Category category = categoryRepository.save(Category.builder().categoryName("DM review " + uniq).isDeleted(false).build());
        Product product = productRepository.save(Product.builder().productName("SP review " + uniq)
                .category(category).price(new BigDecimal("199000.00")).build());
        productId = product.getId();
        otherProductId = productRepository.save(Product.builder().productName("SP review khac " + uniq)
                .category(category).price(new BigDecimal("99000.00")).build()).getId();
        variant = variantRepository.save(ProductVariant.builder().product(product).color("Đen").size("M")
                .barcode("RV-" + uniq).isDeleted(false).build());

        buyer = newCustomerAccount("buyer", "Nguyễn", "Văn An");
        Account stranger = newCustomerAccount("stranger", "Trần", "Thị Bình");
        buyerToken = jwtProvider.generateToken(buyer.getUsername(), "CUSTOMER", buyer.getId(), buyer.getTokenVersion());
        strangerToken = jwtProvider.generateToken(stranger.getUsername(), "CUSTOMER", stranger.getId(), stranger.getTokenVersion());
        Account admin = accountRepository.findByUsername("admin").orElseThrow();
        adminToken = jwtProvider.generateToken("admin", "ADMIN", admin.getId(), admin.getTokenVersion());
    }

    private Account newCustomerAccount(String tag, String ho, String ten) {
        Account account = accountRepository.saveAndFlush(Account.builder()
                .username("rv-" + tag + "-" + uniq)
                .password(passwordEncoder.encode("MatKhau123"))
                .email("rv-" + tag + "-" + uniq + "@example.invalid")
                .role(roleRepository.findByName(RoleType.CUSTOMER).orElseThrow())
                .status(AccountStatus.ACTIVE)
                .isDeleted(false)
                .build());
        customerRepository.saveAndFlush(Customer.builder().firstName(ho).lastName(ten).account(account)
                .phoneNumber("09" + String.format("%08d", Math.floorMod(System.nanoTime() + tag.hashCode(), 100_000_000L)))
                .build());
        return account;
    }

    private void giveOrder(Account account, OrderStatus status) {
        Customer customer = customerRepository.findByAccount_Username(account.getUsername()).orElseThrow();
        Order order = orderRepository.saveAndFlush(Order.builder().orderCode("RV" + uniq + status.name())
                .customer(customer).status(status).build());
        OrderDetailId id = new OrderDetailId();
        id.setOrderId(order.getId());
        id.setSkuId(variant.getId());
        orderDetailRepository.saveAndFlush(OrderDetail.builder().id(id).order(order).variant(variant)
                .quantity(1).unitPrice(new BigDecimal("199000.00")).build());
    }

    private record Resp(int status, String body) {
        JsonNode json() throws Exception {
            return new ObjectMapper().readTree(body);
        }
    }

    private Resp call(String method, String path, String json, String token) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .header("Content-Type", "application/json");
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        builder.method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json));
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        return new Resp(response.statusCode(), response.body());
    }

    private String url() {
        return "/api/v1/reviews/products/" + productId;
    }

    private static String review(int rating, String fit, String body) {
        return "{\"rating\":" + rating + ",\"title\":\"Đáng tiền\",\"body\":\"" + body + "\",\"sizeFit\":" + (fit == null ? "null" : "\"" + fit + "\"") + "}";
    }

    @Test
    @DisplayName("Public đọc danh sách + tổng quan không cần đăng nhập; sản phẩm chưa có đánh giá trả 0")
    void publicReadWithoutLogin() throws Exception {
        Resp summary = call("GET", url() + "/summary", null, null);
        assertThat(summary.status()).as(summary.body()).isEqualTo(200);
        assertThat(summary.json().at("/result/count").asLong()).isZero();
        assertThat(summary.json().at("/result/average").asDouble()).isZero();
        assertThat(summary.json().at("/result/distribution/5").asLong()).isZero();
        Resp list = call("GET", url(), null, null);
        assertThat(list.status()).isEqualTo(200);
        assertThat(list.json().at("/result/totalElements").asLong()).isZero();
        assertThat(call("GET", "/api/v1/reviews/products/999999999/summary", null, null).status()).isEqualTo(404);
    }

    @Test
    @DisplayName("Chưa đăng nhập 401; khách chưa nhận hàng 403; đơn chưa COMPLETED vẫn 403")
    void notEligibleWithoutDeliveredOrder() throws Exception {
        assertThat(call("POST", url(), review(5, "VUA", "Rất ổn"), null).status()).isEqualTo(401);
        Resp denied = call("POST", url(), review(5, "VUA", "Rất ổn"), strangerToken);
        assertThat(denied.status()).as(denied.body()).isEqualTo(403);
        assertThat(denied.json().get("code").asInt()).isEqualTo(4301);

        giveOrder(buyer, OrderStatus.SHIPPING);
        assertThat(call("POST", url(), review(5, null, "Chưa nhận"), buyerToken).status()).isEqualTo(403);
        Resp me = call("GET", url() + "/me", null, buyerToken);
        assertThat(me.json().at("/result/canReview").asBoolean()).isFalse();
        assertThat(me.json().at("/result/reason").asText()).isEqualTo("NOT_PURCHASED");
    }

    @Test
    @DisplayName("Khách đã nhận hàng: tạo, trùng 409, sửa, xóa mềm rồi viết lại; tên được rút gọn")
    void createUpdateDeleteLifecycle() throws Exception {
        giveOrder(buyer, OrderStatus.COMPLETED);
        Resp created = call("POST", url(), review(4, "NHO", "Áo đẹp nhưng hơi chật vai"), buyerToken);
        assertThat(created.status()).as(created.body()).isEqualTo(201);
        assertThat(created.json().at("/result/verifiedPurchase").asBoolean()).isTrue();
        assertThat(created.json().at("/result/authorName").asText()).isEqualTo("Nguyễn A.");

        assertThat(call("POST", url(), review(5, "VUA", "Lần hai"), buyerToken).status()).isEqualTo(409);

        Resp me = call("GET", url() + "/me", null, buyerToken);
        assertThat(me.json().at("/result/alreadyReviewed").asBoolean()).isTrue();
        assertThat(me.json().at("/result/myReview/rating").asInt()).isEqualTo(4);

        Resp updated = call("PUT", url(), review(5, "VUA", "Giặt xong form vẫn đẹp"), buyerToken);
        assertThat(updated.status()).as(updated.body()).isEqualTo(200);
        assertThat(updated.json().at("/result/rating").asInt()).isEqualTo(5);

        Resp invalid = call("PUT", url(), review(7, null, "x"), buyerToken);
        assertThat(invalid.status()).isEqualTo(400);

        assertThat(call("DELETE", url(), null, buyerToken).status()).isEqualTo(200);
        assertThat(call("GET", url(), null, null).json().at("/result/totalElements").asLong()).isZero();
        assertThat(call("PUT", url(), review(5, null, "x"), buyerToken).status()).isEqualTo(404);
        // Sau khi xóa mềm có thể viết lại (unique chỉ áp dụng cho bản ghi chưa xóa).
        assertThat(call("POST", url(), review(3, "RONG", "Viết lại"), buyerToken).status()).isEqualTo(201);
    }

    @Test
    @DisplayName("Tổng quan: trung bình, phân bố sao, cảm nhận size; lọc sao và sắp xếp")
    void summaryFilterAndSort() throws Exception {
        giveOrder(buyer, OrderStatus.COMPLETED);
        assertThat(call("POST", url(), review(5, "VUA", "Rất hài lòng"), buyerToken).status()).isEqualTo(201);
        // Bốn lượt chưa đủ mẫu cho cảm nhận size.
        int[] ratings = {4, 4, 2};
        String[] fits = {"VUA", "VUA", "NHO"};
        for (int i = 0; i < ratings.length; i++) {
            Account other = newCustomerAccount("extra" + i, "Lê", "Minh " + i);
            jdbc.update("INSERT INTO product_review (product_id, account_id, rating, body, size_fit, verified_purchase, created_at) "
                    + "VALUES (?,?,?,?,?,true, now() - (?::int * interval '1 day'))",
                    productId, other.getId(), ratings[i], "Nhận xét " + i, fits[i], i + 1);
        }
        JsonNode s = call("GET", url() + "/summary", null, null).json().get("result");
        assertThat(s.get("count").asLong()).isEqualTo(4);
        assertThat(s.get("average").asDouble()).isEqualTo(3.8);
        assertThat(s.at("/distribution/5").asLong()).isEqualTo(1);
        assertThat(s.at("/distribution/4").asLong()).isEqualTo(2);
        assertThat(s.at("/distribution/2").asLong()).isEqualTo(1);
        assertThat(s.get("fitCount").asLong()).isEqualTo(4);
        assertThat(s.get("fitVerdict").isNull()).isTrue();
        Account fifth = newCustomerAccount("extra4", "Lê", "Minh 4");
        jdbc.update("INSERT INTO product_review (product_id, account_id, rating, body, size_fit, verified_purchase, created_at) VALUES (?,?,?,?,?,true, now() - interval '5 days')",
                productId, fifth.getId(), 3, "Nhận xét thứ năm", "VUA");
        assertThat(call("GET", url() + "/summary", null, null).json().at("/result/fitVerdict").asText()).isEqualTo("VUA");

        JsonNode onlyFour = call("GET", url() + "?rating=4", null, null).json().get("result");
        assertThat(onlyFour.get("totalElements").asLong()).isEqualTo(2);
        JsonNode lowest = call("GET", url() + "?sort=rating_asc&size=2", null, null).json().get("result");
        assertThat(lowest.get("content").get(0).get("rating").asInt()).isEqualTo(2);
        assertThat(lowest.get("totalPages").asInt()).isEqualTo(3);
        JsonNode newest = call("GET", url(), null, null).json().get("result");
        assertThat(newest.get("content").get(0).get("rating").asInt()).isEqualTo(5);
        assertThat(call("GET", url() + "?rating=9", null, null).status()).isEqualTo(400);
        assertThat(call("GET", url() + "?sort=abc", null, null).status()).isEqualTo(400);
        // Public list không lộ cờ kiểm duyệt.
        assertThat(newest.get("content").get(0).has("hidden")).isFalse();
    }

    @Test
    @DisplayName("ADMIN ẩn đánh giá: biến mất khỏi public + tổng quan; khách thường bị 403; hiện lại được")
    void adminHideAndUnhide() throws Exception {
        giveOrder(buyer, OrderStatus.COMPLETED);
        Resp created = call("POST", url(), review(1, "NHO", "Quá tệ"), buyerToken);
        long reviewId = created.json().at("/result/id").asLong();

        String patch = "/api/v1/admin/reviews/" + reviewId + "/visibility";
        assertThat(call("PATCH", patch, "{\"hidden\":true,\"reason\":\"Spam\"}", buyerToken).status()).isEqualTo(403);
        Resp hidden = call("PATCH", patch, "{\"hidden\":true,\"reason\":\"Spam\"}", adminToken);
        assertThat(hidden.status()).as(hidden.body()).isEqualTo(200);
        assertThat(hidden.json().at("/result/hidden").asBoolean()).isTrue();
        assertThat(call("GET", url(), null, null).json().at("/result/totalElements").asLong()).isZero();
        assertThat(call("GET", url() + "/summary", null, null).json().at("/result/count").asLong()).isZero();
        Resp adminList = call("GET", "/api/v1/admin/reviews?hidden=true&productId=" + productId, null, adminToken);
        assertThat(adminList.json().at("/result/totalElements").asLong()).isEqualTo(1);
        assertThat(adminList.json().at("/result/content/0/productName").asText()).startsWith("SP review");

        assertThat(call("PATCH", patch, "{\"hidden\":false}", adminToken).status()).isEqualTo(200);
        assertThat(call("GET", url(), null, null).json().at("/result/totalElements").asLong()).isEqualTo(1);
        assertThat(call("PATCH", "/api/v1/admin/reviews/999999999/visibility", "{\"hidden\":true}", adminToken).status()).isEqualTo(404);
    }

    @Test
    @DisplayName("Đơn của sản phẩm khác không đủ điều kiện đánh giá sản phẩm này")
    void orderForOtherProductDoesNotQualify() throws Exception {
        giveOrder(buyer, OrderStatus.COMPLETED);
        Resp denied = call("POST", "/api/v1/reviews/products/" + otherProductId, review(5, null, "Không mua"), buyerToken);
        assertThat(denied.status()).isEqualTo(403);
    }

    @Test
    @DisplayName("Gửi đồng thời hai lần: một 201, còn lại 409 (không bao giờ 500)")
    void concurrentDoubleSubmitIsConflictNotServerError() throws Exception {
        giveOrder(buyer, OrderStatus.COMPLETED);
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
        java.util.List<java.util.concurrent.Future<Resp>> calls = new java.util.ArrayList<>();
        for (int i = 0; i < 2; i++) {
            calls.add(pool.submit(() -> {
                go.await();
                return call("POST", url(), review(5, "VUA", "Gửi đồng thời"), buyerToken);
            }));
        }
        go.countDown();
        java.util.List<Integer> statuses = new java.util.ArrayList<>();
        for (java.util.concurrent.Future<Resp> f : calls) statuses.add(f.get().status());
        pool.shutdown();
        assertThat(statuses).containsExactlyInAnyOrder(201, 409);
    }

    @Test
    @DisplayName("Sản phẩm liên quan: cùng danh mục trước, chỉ hàng còn tồn + ACTIVE, loại trừ chính nó")
    void relatedProductsOnlyLiveAndInStock() throws Exception {
        Category category = categoryRepository.save(Category.builder().categoryName("DM related " + uniq).isDeleted(false).build());
        Product main = productRepository.save(Product.builder().productName("SP chinh " + uniq).category(category).price(new BigDecimal("100000.00")).build());
        Product inStock = productRepository.save(Product.builder().productName("SP con hang " + uniq).category(category).price(new BigDecimal("110000.00")).build());
        Product noStock = productRepository.save(Product.builder().productName("SP het hang " + uniq).category(category).price(new BigDecimal("120000.00")).build());
        Product inactive = productRepository.save(Product.builder().productName("SP ngung " + uniq).category(category).price(new BigDecimal("130000.00"))
                .status(com.springboot.fasearch.common.enums.ProductStatus.DISCONTINUED).build());
        for (Product p : java.util.List.of(main, inStock, noStock, inactive)) {
            ProductVariant v = variantRepository.save(ProductVariant.builder().product(p).color("Đen").size("M").barcode("RL-" + p.getId() + "-" + uniq).isDeleted(false).build());
            int qty = p == noStock ? 0 : 5;
            jdbc.update("INSERT INTO ton_kho (ma_sku, so_luong_vat_ly, so_luong_tam_giu, so_luong_kha_dung, nguong_toi_thieu, da_xoa) VALUES (?,?,0,?,10,false)", v.getId(), qty, qty);
        }
        Resp res = call("GET", "/api/v1/products/" + main.getId() + "/related?limit=8", null, null);
        assertThat(res.status()).as(res.body()).isEqualTo(200);
        java.util.List<Long> ids = new java.util.ArrayList<>();
        res.json().get("result").forEach(n -> ids.add(n.get("id").asLong()));
        assertThat(ids).containsExactly(inStock.getId());
        assertThat(call("GET", "/api/v1/products/999999999/related", null, null).status()).isEqualTo(404);
    }
}
