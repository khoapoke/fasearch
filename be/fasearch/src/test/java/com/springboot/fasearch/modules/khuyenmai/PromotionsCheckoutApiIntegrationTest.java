package com.springboot.fasearch.modules.khuyenmai;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import org.junit.jupiter.api.BeforeEach;
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
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.order.entity.Cart;
import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PromotionsCheckoutApiIntegrationTest {
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
    @Autowired private JwtProvider jwtProvider;
    @Autowired private AccountRepository accountRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository customerRepository;
    @Autowired private CartRepository cartRepository;
    @Autowired private CartItemRepository cartItemRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ProductVariantRepository variantRepository;
    @Autowired private InventoryRepository inventoryRepository;

    private final HttpClient http = HttpClient.newHttpClient();
    private String suffix;
    private String adminToken;
    private String customerToken;
    private String otherCustomerToken;
    private Long productId;
    private Long skuId;
    private Long customerId;
    private String campaignName;
    private String voucherCode;

    @BeforeEach
    void setUp() {
        suffix = Long.toString(System.nanoTime(), 36);
        campaignName = "Promo API " + suffix;
        voucherCode = ("API" + suffix).toUpperCase(java.util.Locale.ROOT);
        Account admin = accountRepository.findByUsername("admin").orElseThrow();
        adminToken = jwtProvider.generateToken(admin.getUsername(), "ADMIN", admin.getId());

        Role customerRole = roleRepository.findByName(RoleType.CUSTOMER).orElseThrow();
        Account customerAccount = accountRepository.saveAndFlush(Account.builder()
                .username("promo-api-" + suffix).password("not-used-in-this-test")
                .email("promo-api-" + suffix + "@example.invalid").role(customerRole)
                .status(AccountStatus.ACTIVE).isDeleted(false).build());
        Customer customer = customerRepository.saveAndFlush(Customer.builder().firstName("API")
                .lastName("Probe").phoneNumber("09" + String.format("%08d", Math.floorMod(System.nanoTime(), 100_000_000L)))
                .address("Test delivery address").accumulatePoint(1000).account(customerAccount).isDeleted(false).build());
        customerId = customer.getId();
        customerToken = jwtProvider.generateToken(customerAccount.getUsername(), "CUSTOMER", customerAccount.getId());
        Account otherAccount = accountRepository.saveAndFlush(Account.builder()
                .username("promo-api-other-" + suffix).password("not-used-in-this-test")
                .email("promo-api-other-" + suffix + "@example.invalid").role(customerRole)
                .status(AccountStatus.ACTIVE).isDeleted(false).build());
        customerRepository.saveAndFlush(Customer.builder().firstName("Other").lastName("Probe")
                .phoneNumber("09" + String.format("%08d", Math.floorMod(System.nanoTime(), 100_000_000L)))
                .address("Other test address").accumulatePoint(0).account(otherAccount).isDeleted(false).build());
        otherCustomerToken = jwtProvider.generateToken(otherAccount.getUsername(), "CUSTOMER", otherAccount.getId());
        cartRepository.saveAndFlush(Cart.builder().customer(customer).totalItems(0).build());

        Category category = categoryRepository.saveAndFlush(Category.builder()
                .categoryName("Promo API category " + suffix).isDeleted(false).build());
        Product product = productRepository.saveAndFlush(Product.builder().productName("Promo API SKU " + suffix)
                .category(category).price(new BigDecimal("100000.00")).build());
        productId = product.getId();
        ProductVariant variant = variantRepository.saveAndFlush(ProductVariant.builder().product(product)
                .color("Black").size("M").barcode("PROMO-API-" + suffix).isDeleted(false).build());
        skuId = variant.getId();
        inventoryRepository.saveAndFlush(Inventory.builder().variant(variant).physicalStock(10)
                .reservedStock(0).availableStock(10).minThreshold(1).isDeleted(false).build());
        cartItemRepository.saveAndFlush(CartItem.builder().cart(cartRepository.findByCustomerId(customerId).orElseThrow())
                .variant(variant).quantity(1).build());
    }

    @Test
    void campaignQuoteStaleCheckoutReplayDetailAndCancellationMatchContract() throws Exception {
        String start = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusHours(1).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String end = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        Resp created = call("POST", "/api/v1/khuyen-mai", """
                {"tenCtkm":"%s","loaiGiam":"PHAN_TRAM","giaTriGiam":10,
                 "ngayBatDau":"%s","ngayKetThuc":"%s","maSpApDung":[%d]}
                """.formatted(campaignName, start, end, productId), adminToken);
        assertThat(created.status()).isEqualTo(201);
        JsonNode campaign = result(created);
        long campaignId = campaign.get("maKm").asLong();
        assertThat(campaign.get("trangThai").asText()).isEqualTo("TAM_DUNG");
        assertThat(campaign.get("codes").isArray()).isTrue();

        Resp activated = call("PUT", "/api/v1/khuyen-mai/" + campaignId,
                "{\"phienBan\":0,\"trangThai\":\"HOAT_DONG\"}", adminToken);
        assertThat(activated.status()).isEqualTo(200);
        assertThat(result(activated).get("ngayBatDau").asText()).doesNotContain("Z", "+");
        Resp issued = call("POST", "/api/v1/khuyen-mai/" + campaignId + "/codes",
                "{\"maCode\":\"  " + voucherCode.toLowerCase(java.util.Locale.ROOT) + "  \",\"soLuongPhatHanh\":3}", adminToken);
        assertThat(issued.status()).isEqualTo(201);
        assertThat(result(issued).get("maCode").asText()).isEqualTo(voucherCode);

        Resp searched = call("GET", "/api/v1/khuyen-mai?q=" + URLEncoder.encode(campaignName, StandardCharsets.UTF_8)
                + "&page=0&size=10", null, adminToken);
        assertThat(searched.status()).isEqualTo(200);
        JsonNode page = result(searched);
        assertThat(page.get("content").size()).isEqualTo(1);
        assertThat(page.get("pageNumber").asInt()).isZero();
        assertThat(page.get("pageSize").asInt()).isEqualTo(10);
        assertThat(page.get("content").get(0).get("codes").isEmpty()).isTrue();
        String forbiddenCampaign = "{\"tenCtkm\":\"Forbidden " + suffix
                + "\",\"loaiGiam\":\"PHAN_TRAM\",\"giaTriGiam\":10,\"ngayBatDau\":\"" + start
                + "\",\"ngayKetThuc\":\"" + end + "\",\"maSpApDung\":[" + productId + "]}";
        Resp staffMutation = call("POST", "/api/v1/khuyen-mai", forbiddenCampaign, token("nhanvien1", "STAFF"));
        assertThat(staffMutation.status()).as("STAFF cannot create campaigns: %s", staffMutation.body()).isEqualTo(403);

        Resp firstQuote = quote();
        JsonNode quote = result(firstQuote);
        String fingerprint = quote.get("quoteFingerprint").asText();
        assertThat(new BigDecimal(quote.get("merchandiseAmountDue").asText())).isEqualByComparingTo("90000.00");
        Product changed = productRepository.findById(productId).orElseThrow();
        changed.setPrice(new BigDecimal("200000.00"));
        productRepository.saveAndFlush(changed);

        String checkoutKey = "checkout-" + suffix;
        String staleBody = checkoutBody(fingerprint, new BigDecimal("90000.00"), checkoutKey, "Apt 1");
        Resp stale = call("POST", "/api/v1/orders/checkout", staleBody, customerToken);
        assertThat(stale.status()).isEqualTo(409);
        assertThat(json(stale).get("code").asInt()).isEqualTo(4107);
        assertThat(stock().getAvailableStock()).isEqualTo(10);
        assertThat(stock().getReservedStock()).isZero();

        quote = result(quote());
        fingerprint = quote.get("quoteFingerprint").asText();
        BigDecimal due = new BigDecimal(quote.get("merchandiseAmountDue").asText());
        assertThat(due).isEqualByComparingTo("180000.00");
        String body = checkoutBody(fingerprint, due, checkoutKey, "Apt 1");
        Resp checkout = call("POST", "/api/v1/orders/checkout", body, customerToken);
        assertThat(checkout.status()).isEqualTo(201);
        JsonNode order = result(checkout);
        long orderId = order.get("orderId").asLong();
        assertThat(order.get("discountAmount").decimalValue()).isEqualByComparingTo("20000.00");
        assertThat(order.get("totalAmount").decimalValue()).isEqualByComparingTo("185000.00");
        assertThat(order.get("status").asText()).isEqualTo("PENDING");
        assertThat(order.get("replayed").asBoolean()).isFalse();
        Resp pointCalculation = call("POST", "/api/v1/payments/calculate",
                "{\"orderId\":" + orderId + ",\"voucherCode\":\"" + voucherCode + "\",\"redeemedPoints\":1}",
                customerToken);
        assertThat(pointCalculation.status()).as("S1 voucher due cannot be reduced by request-only points").isEqualTo(400);

        Resp replay = call("POST", "/api/v1/orders/checkout", body, customerToken);
        assertThat(replay.status()).isEqualTo(200);
        assertThat(result(replay).get("orderId").asLong()).isEqualTo(orderId);
        assertThat(result(replay).get("replayed").asBoolean()).isTrue();
        Resp conflict = call("POST", "/api/v1/orders/checkout",
                checkoutBody(fingerprint, due, checkoutKey, "Apt 2"), customerToken);
        assertThat(conflict.status()).isEqualTo(409);
        assertThat(json(conflict).get("code").asInt()).isEqualTo(4108);

        Resp otherCustomerDetail = call("GET", "/api/v1/orders/" + orderId, null, otherCustomerToken);
        assertThat(otherCustomerDetail.status()).isEqualTo(403);
        Resp detail = call("GET", "/api/v1/orders/" + orderId, null, adminToken);
        assertThat(detail.status()).isEqualTo(200);
        JsonNode detailOrder = result(detail);
        assertThat(detailOrder.get("voucherCode").asText()).isEqualTo(voucherCode);
        assertThat(detailOrder.get("discountAmount").decimalValue()).isEqualByComparingTo("20000.00");
        assertThat(detailOrder.get("items").get(0).get("discountAmount").decimalValue()).isEqualByComparingTo("20000.00");
        assertThat(stock().getReservedStock()).isEqualTo(1);

        Resp cancel = call("POST", "/api/v1/orders/" + orderId + "/cancel", "{\"reason\":\"API cancellation check\"}", adminToken);
        assertThat(cancel.status()).isEqualTo(200);
        assertThat(stock().getAvailableStock()).isEqualTo(10);
        assertThat(stock().getReservedStock()).isZero();
        Resp campaignAfter = call("GET", "/api/v1/khuyen-mai/" + campaignId, null, adminToken);
        JsonNode codeAfter = result(campaignAfter).get("codes").get(0);
        assertThat(codeAfter.get("soLuongGiuCho").asInt()).isZero();
        assertThat(codeAfter.get("daSuDung").asInt()).isZero();
        assertThat(usageStatus(orderId)).isEqualTo("RELEASED");
        assertThat(call("POST", "/api/v1/orders/" + orderId + "/cancel", "{\"reason\":\"repeat\"}", adminToken).status()).isEqualTo(400);
        assertThat(usageStatus(orderId)).isEqualTo("RELEASED");

        assertThat(call("POST", "/api/v1/cart/items", "{\"skuId\":" + skuId + ",\"quantity\":1}", customerToken).status()).isEqualTo(200);
        JsonNode settlementQuote = result(quote());
        BigDecimal settlementDue = new BigDecimal(settlementQuote.get("merchandiseAmountDue").asText());
        String settlementBody = checkoutBody(settlementQuote.get("quoteFingerprint").asText(), settlementDue,
                "settlement-" + suffix, "Apt 3");
        Resp settlementCheckout = call("POST", "/api/v1/orders/checkout", settlementBody, customerToken);
        assertThat(settlementCheckout.status()).isEqualTo(201);
        long settlementOrderId = result(settlementCheckout).get("orderId").asLong();
        for (String status : new String[]{"CONFIRMED", "PACKING", "SHIPPING"}) {
            assertThat(updateStatus(settlementOrderId, status).status()).isEqualTo(200);
        }
        assertThat(updateStatus(settlementOrderId, "COMPLETED").status()).isEqualTo(400);
        Resp cancelAfterHandoff = call("POST", "/api/v1/orders/" + settlementOrderId + "/cancel",
                "{\"reason\":\"handoff cancellation must retain benefit\"}", adminToken);
        assertThat(cancelAfterHandoff.status()).isEqualTo(400);
        assertThat(usageStatus(settlementOrderId)).isEqualTo("HELD");
        assertThat(stock().getReservedStock()).isEqualTo(1);
        BigDecimal collectedAmount = settlementDue.add(BigDecimal.valueOf(5000));
        Resp underpaid = call("POST", "/api/v1/payments/process",
                paymentBody(settlementOrderId, collectedAmount.subtract(BigDecimal.ONE)), adminToken);
        assertThat(underpaid.status()).isEqualTo(400);
        assertThat(usageStatus(settlementOrderId)).isEqualTo("HELD");
        assertThat(stock().getReservedStock()).isEqualTo(1);
        assertThat(call("POST", "/api/v1/payments/process", paymentBody(settlementOrderId, collectedAmount), customerToken).status()).isEqualTo(403);
        Resp settled = call("POST", "/api/v1/payments/process",
                paymentBody(settlementOrderId, settlementDue.add(BigDecimal.valueOf(5000))), adminToken);
        assertThat(settled.status()).isEqualTo(201);
        assertThat(result(settled).get("paymentStatus").asText()).isEqualTo("PAID");
        assertThat(call("POST", "/api/v1/payments/process",
                paymentBody(settlementOrderId, settlementDue.add(BigDecimal.valueOf(5000))), adminToken).status()).isEqualTo(400);
        assertThat(updateStatus(settlementOrderId, "COMPLETED").status()).isEqualTo(200);
        assertThat(stock().getPhysicalStock()).isEqualTo(9);
        assertThat(stock().getReservedStock()).isZero();
        Resp settledCampaign = call("GET", "/api/v1/khuyen-mai/" + campaignId, null, adminToken);
        assertThat(result(settledCampaign).get("codes").get(0).get("soLuongGiuCho").asInt()).isZero();
        assertThat(result(settledCampaign).get("codes").get(0).get("daSuDung").asInt()).isEqualTo(1);
        assertThat(usageStatus(settlementOrderId)).isEqualTo("CONSUMED");
        assertThat(customerRepository.findById(customerId).orElseThrow().getAccumulatePoint()).isEqualTo(1000);

        assertThat(call("POST", "/api/v1/cart/items", "{\"skuId\":" + skuId + ",\"quantity\":1}", customerToken).status()).isEqualTo(200);
        Resp legacyCheckout = call("POST", "/api/v1/orders/checkout",
                "{\"deliveryAddress\":\"Legacy no-voucher order\",\"shippingFee\":5000,\"paymentMethod\":\"COD\"}", customerToken);
        assertThat(legacyCheckout.status()).isEqualTo(201);
        long legacyOrderId = result(legacyCheckout).get("orderId").asLong();
        Resp legacyPointCalculation = call("POST", "/api/v1/payments/calculate",
                "{\"orderId\":" + legacyOrderId + ",\"redeemedPoints\":1}", customerToken);
        assertThat(legacyPointCalculation.status()).isEqualTo(200);
        assertThat(result(legacyPointCalculation).get("pointDiscount").decimalValue()).isEqualByComparingTo("1000.00");
        assertThat(customerRepository.findById(customerId).orElseThrow().getAccumulatePoint()).isEqualTo(1000);
        Order legacyOrder = orderRepository.findById(legacyOrderId).orElseThrow();
        legacyOrder.setVoucherId(30L); // Existing V8 orders can have a voucher FK without the new S1 code snapshot.
        orderRepository.saveAndFlush(legacyOrder);
        assertThat(legacyOrder.getVoucherCode()).isNull();
        for (String status : new String[]{"CONFIRMED", "PACKING", "SHIPPING"}) {
            assertThat(updateStatus(legacyOrderId, status).status()).isEqualTo(200);
        }
        Resp legacyCancel = call("POST", "/api/v1/orders/" + legacyOrderId + "/cancel",
                "{\"reason\":\"Legacy no-voucher cancellation compatibility\"}", adminToken);
        assertThat(legacyCancel.status()).isEqualTo(200);
        assertThat(result(legacyCancel).get("status").asText()).isEqualTo("CANCELLED");
        assertThat(stock().getPhysicalStock()).isEqualTo(9);
        assertThat(stock().getAvailableStock()).isEqualTo(9);
        assertThat(stock().getReservedStock()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from su_dung_voucher where ma_don_hang = ?", Integer.class, legacyOrderId)).isZero();

        assertThat(call("POST", "/api/v1/cart/items", "{\"skuId\":" + skuId + ",\"quantity\":1}", customerToken).status()).isEqualTo(200);
        Resp legacyPayCheckout = call("POST", "/api/v1/orders/checkout",
                "{\"deliveryAddress\":\"Legacy voucher FK payment compatibility\",\"shippingFee\":5000,\"paymentMethod\":\"COD\"}", customerToken);
        assertThat(legacyPayCheckout.status()).isEqualTo(201);
        long legacyPayOrderId = result(legacyPayCheckout).get("orderId").asLong();
        Order legacyPayOrder = orderRepository.findById(legacyPayOrderId).orElseThrow();
        legacyPayOrder.setVoucherId(30L);
        orderRepository.saveAndFlush(legacyPayOrder);
        BigDecimal legacyDue = result(legacyPayCheckout).get("totalAmount").decimalValue();
        Resp legacyCustomerPayment = call("POST", "/api/v1/payments/process",
                paymentBody(legacyPayOrderId, legacyDue.add(BigDecimal.valueOf(5000))), customerToken);
        assertThat(legacyCustomerPayment.status()).as("Legacy V8 voucher FK without S1 code snapshot remains payable: %s", legacyCustomerPayment.body()).isEqualTo(201);
        assertThat(result(legacyCustomerPayment).get("paymentStatus").asText()).isEqualTo("PAID");
    }

    private Resp updateStatus(long orderId, String status) {
        return call("PATCH", "/api/v1/orders/" + orderId + "/status", "{\"status\":\"" + status + "\"}", adminToken);
    }

    private String paymentBody(long orderId, BigDecimal amount) {
        return "{\"orderId\":" + orderId + ",\"paymentMethodCode\":\"CASH\",\"amountPaid\":" + amount + "}";
    }

    private Resp quote() {
        return call("POST", "/api/v1/cart/quote", "{\"voucherCode\":\"" + voucherCode + "\"}", customerToken);
    }

    private String checkoutBody(String fingerprint, BigDecimal due, String key, String address) {
        return "{\"deliveryAddress\":\"" + address + "\",\"voucherCode\":\"" + voucherCode
                + "\",\"quoteFingerprint\":\"" + fingerprint + "\",\"expectedMerchandiseAmountDue\":" + due
                + ",\"checkoutKey\":\"" + key + "\",\"shippingFee\":5000,\"paymentMethod\":\"COD\"}";
    }

    private Inventory stock() {
        return inventoryRepository.findByVariantId(skuId).orElseThrow();
    }

    private String usageStatus(Long orderId) {
        return jdbcStatus(orderId);
    }

    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private String jdbcStatus(Long orderId) {
        return jdbc.queryForObject("select trang_thai from su_dung_voucher where ma_don_hang = ?", String.class, orderId);
    }

    private String token(String username, String role) {
        Account account = accountRepository.findByUsername(username).orElseThrow();
        return jwtProvider.generateToken(username, role, account.getId());
    }

    private record Resp(int status, String body) {
        boolean is2xx() { return status >= 200 && status < 300; }
    }

    private Resp call(String method, String path, String body, String token) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Content-Type", "application/json");
            if (token != null) request.header("Authorization", "Bearer " + token);
            request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body));
            HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
            return new Resp(response.statusCode(), response.body());
        } catch (Exception e) {
            throw new IllegalStateException("HTTP test call failed: " + method + " " + path, e);
        }
    }

    private JsonNode result(Resp response) throws Exception {
        assertThat(response.is2xx()).as("status=%s body=%s", response.status(), response.body()).isTrue();
        return json(response).get("result");
    }

    private JsonNode json(Resp response) {
        try { return mapper.readTree(response.body()); }
        catch (Exception e) { throw new IllegalStateException("Invalid JSON response", e); }
    }
}
