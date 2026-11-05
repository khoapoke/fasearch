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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

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
import com.springboot.fasearch.common.enums.OrderStatus;
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
import com.springboot.fasearch.modules.order.entity.OrderDetail;
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
import com.springboot.fasearch.modules.user.entity.MembershipTier;
import com.springboot.fasearch.modules.user.repository.MembershipTierRepository;
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
    @Autowired private MembershipTierRepository tierRepository;
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
        long voucherId = result(issued).get("maVoucher").asLong();

        Resp searched = call("GET", "/api/v1/khuyen-mai?q=" + URLEncoder.encode(campaignName, StandardCharsets.UTF_8)
                + "&page=0&size=10", null, adminToken);
        assertThat(searched.status()).isEqualTo(200);
        JsonNode page = result(searched);
        assertThat(page.get("content").size()).isEqualTo(1);
        assertThat(page.get("pageNumber").asInt()).isZero();
        assertThat(page.get("pageSize").asInt()).isEqualTo(10);
        assertThat(page.has("last")).isTrue();
        assertThat(page.get("last").isBoolean()).isTrue();
        assertThat(page.has("isLast")).isFalse();
        assertThat(page.get("content").get(0).get("codes").isEmpty()).isTrue();
        // STAFF = Quản lý: được tạo chương trình khuyến mãi; CUSTOMER và tài khoản đăng nhập vẫn bị chặn.
        String managerCampaign = "{\"tenCtkm\":\"Manager " + suffix
                + "\",\"loaiGiam\":\"PHAN_TRAM\",\"giaTriGiam\":10,\"ngayBatDau\":\"" + start
                + "\",\"ngayKetThuc\":\"" + end + "\",\"maSpApDung\":[" + productId + "]}";
        Resp staffMutation = call("POST", "/api/v1/khuyen-mai", managerCampaign, token("nhanvien1", "STAFF"));
        assertThat(staffMutation.status()).as("STAFF can create campaigns: %s", staffMutation.body()).isEqualTo(201);
        assertThat(result(staffMutation).get("trangThai").asText()).isEqualTo("TAM_DUNG");
        Resp customerMutation = call("POST", "/api/v1/khuyen-mai", managerCampaign, customerToken);
        assertThat(customerMutation.status()).as("CUSTOMER cannot create campaigns").isEqualTo(403);
        assertThat(call("POST", "/api/v1/auth/accounts", "{}", token("nhanvien1", "STAFF")).status())
                .as("STAFF cannot create login accounts").isEqualTo(403);

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
        assertThat(pointCalculation.status()).as("A committed S2 quote rejects a changed point count").isEqualTo(409);
        assertThat(json(pointCalculation).get("code").asInt()).isEqualTo(4107);

        OrderDetail legacyLine = OrderDetail.builder().variant(variantRepository.findById(skuId).orElseThrow())
                .quantity(1).unitPrice(new BigDecimal("200000.00"))
                .discountAmount(new BigDecimal("20000.00")).build();
        Order legacyVoucherOrder = Order.builder().orderCode("S1-LEGACY-VOUCHER-" + suffix)
                .customer(customerRepository.findById(customerId).orElseThrow()).status(OrderStatus.PENDING)
                .shippingFee(new BigDecimal("5000.00")).voucherId(voucherId).voucherCode(voucherCode)
                .voucherCampaignName(campaignName).voucherCampaignVersion(1L)
                .discountAmount(new BigDecimal("20000.00")).totalAmount(new BigDecimal("185000.00"))
                .details(new ArrayList<>(List.of(legacyLine))).isDeleted(false).build();
        legacyLine.setOrder(legacyVoucherOrder);
        legacyVoucherOrder = orderRepository.saveAndFlush(legacyVoucherOrder);
        Resp legacyVoucherPointCalculation = call("POST", "/api/v1/payments/calculate",
                "{\"orderId\":" + legacyVoucherOrder.getId() + ",\"voucherCode\":\"" + voucherCode
                        + "\",\"redeemedPoints\":1}", customerToken);
        assertThat(legacyVoucherPointCalculation.status()).as("A pre-S2 voucher snapshot rejects request-only points as invalid").isEqualTo(400);

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
        JsonNode settledReceipt = result(settled);
        assertThat(settledReceipt.get("paymentStatus").asText()).isEqualTo("PAID");
        int earnedPoints = settledReceipt.path("earnedPoints").isNumber()
                ? settledReceipt.path("earnedPoints").asInt() : 0;
        int balanceAfterSettlement = 1000 + earnedPoints;
        assertThat(call("POST", "/api/v1/payments/process",
                paymentBody(settlementOrderId, settlementDue.add(BigDecimal.valueOf(5000))), adminToken).status()).isEqualTo(400);
        assertThat(updateStatus(settlementOrderId, "COMPLETED").status()).isEqualTo(200);
        assertThat(stock().getPhysicalStock()).isEqualTo(9);
        assertThat(stock().getReservedStock()).isZero();
        Resp settledCampaign = call("GET", "/api/v1/khuyen-mai/" + campaignId, null, adminToken);
        assertThat(result(settledCampaign).get("codes").get(0).get("soLuongGiuCho").asInt()).isZero();
        assertThat(result(settledCampaign).get("codes").get(0).get("daSuDung").asInt()).isEqualTo(1);
        assertThat(usageStatus(settlementOrderId)).isEqualTo("CONSUMED");
        assertThat(customerRepository.findById(customerId).orElseThrow().getAccumulatePoint()).isEqualTo(balanceAfterSettlement);

        assertThat(call("POST", "/api/v1/cart/items", "{\"skuId\":" + skuId + ",\"quantity\":1}", customerToken).status()).isEqualTo(200);
        Resp legacyCheckout = call("POST", "/api/v1/orders/checkout",
                "{\"deliveryAddress\":\"Legacy no-voucher order\",\"shippingFee\":5000,\"paymentMethod\":\"COD\"}", customerToken);
        assertThat(legacyCheckout.status()).isEqualTo(201);
        long legacyOrderId = result(legacyCheckout).get("orderId").asLong();
        Order legacyOrder = orderRepository.findById(legacyOrderId).orElseThrow();
        legacyOrder.setRedeemedPoints(0);
        legacyOrder.setPointsDiscount(BigDecimal.ZERO);
        legacyOrder.setLoyaltyPolicyId(null);
        legacyOrder.setLoyaltyPolicyVersion(null);
        legacyOrder.setRedeemCurrencyPerPointSnapshot(null);
        legacyOrder.setEarnedPoints(null);
        legacyOrder.setLoyaltyQuoteFingerprint(null);
        orderRepository.saveAndFlush(legacyOrder);
        assertOrderListDetailParity(legacyOrderId, null, null, null, null);
        Resp legacyPointCalculation = call("POST", "/api/v1/payments/calculate",
                "{\"orderId\":" + legacyOrderId + ",\"redeemedPoints\":1}", customerToken);
        assertThat(legacyPointCalculation.status()).isEqualTo(200);
        assertThat(result(legacyPointCalculation).get("pointDiscount").decimalValue()).isEqualByComparingTo("1000.00");
        assertThat(customerRepository.findById(customerId).orElseThrow().getAccumulatePoint()).isEqualTo(balanceAfterSettlement);
        legacyOrder.setVoucherId(voucherId); // Legacy orders can keep a voucher FK without the S1 code snapshot; use the voucher created above (no hard-coded seed id).
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
        legacyPayOrder.setVoucherId(voucherId); // valid voucher created above (was hard-coded seed id 30)
        orderRepository.saveAndFlush(legacyPayOrder);
        BigDecimal legacyDue = result(legacyPayCheckout).get("totalAmount").decimalValue();
        Resp legacyCustomerPayment = call("POST", "/api/v1/payments/process",
                paymentBody(legacyPayOrderId, legacyDue.add(BigDecimal.valueOf(5000))), customerToken);
        assertThat(legacyCustomerPayment.status()).as("Legacy V8 voucher FK without S1 code snapshot remains payable: %s", legacyCustomerPayment.body()).isEqualTo(201);
        assertThat(result(legacyCustomerPayment).get("paymentStatus").asText()).isEqualTo("PAID");

        Resp editedCampaign = call("PUT", "/api/v1/khuyen-mai/" + campaignId,
                "{\"phienBan\":1,\"tenCtkm\":\"Changed " + suffix + "\"}", adminToken);
        assertThat(editedCampaign.status()).isEqualTo(200);
        assertThat(result(editedCampaign).get("phienBan").asLong()).isEqualTo(2);
        assertOrderListDetailParity(orderId, voucherId, voucherCode, campaignName, 1L);
    }

    @Test
    void loyaltyApiOpensPointsQuotesSettlesAndAssignsTierFromActualPaidSales() throws Exception {
        String staffToken = token("nhanvien1", "STAFF");
        Customer customer = customerRepository.findById(customerId).orElseThrow();
        long otherCustomerId = customerRepository.findByAccount_Username("promo-api-other-" + suffix).orElseThrow().getId();

        Resp initialBalance = call("GET", "/api/v1/thanh-vien", null, customerToken);
        assertThat(initialBalance.cacheControl()).contains("no-store");
        JsonNode initial = result(initialBalance);
        assertThat(initial.get("openingRecorded").asBoolean()).isFalse();
        assertThat(initial.get("availablePoints").isNull()).isTrue();
        assertThat(initial.get("salesTierStatus").asText()).isEqualTo("HISTORY_UNKNOWN");
        assertThat(result(call("GET", "/api/v1/thanh-vien/lich-su", null, customerToken)).get("content")).isEmpty();
        assertThat(call("GET", "/api/v1/thanh-vien/lich-su", null, staffToken).status()).isEqualTo(403);
        assertThat(call("GET", "/api/v1/users/customers/" + otherCustomerId, null, customerToken).status()).isEqualTo(403);
        assertThat(call("GET", "/api/v1/thanh-vien/chinh-sach", null, customerToken).status()).isEqualTo(403);
        assertThat(call("POST", "/api/v1/quan-tri/thanh-vien/mo-dau",
                "{\"customerId\":" + customerId + "}", staffToken).status()).isEqualTo(403);

        disableActiveLoyaltyPolicyIfPresent();
        Resp createdPolicy = call("POST", "/api/v1/thanh-vien/chinh-sach",
                "{\"earnCurrencyPerPoint\":25000,\"redeemCurrencyPerPoint\":1000}", adminToken);
        assertThat(createdPolicy.status()).isEqualTo(201);
        JsonNode policy = result(createdPolicy);
        long policyId = policy.get("policyId").asLong();
        assertThat(policy.get("status").asText()).isEqualTo("DISABLED");
        Resp quoteBeforeOpening = call("POST", "/api/v1/cart/quote", "{\"redeemedPoints\":1}", customerToken);
        assertThat(quoteBeforeOpening.status()).isEqualTo(409);
        assertThat(json(quoteBeforeOpening).get("code").asInt()).isEqualTo(4201);

        Resp opened = call("POST", "/api/v1/quan-tri/thanh-vien/mo-dau",
                "{\"customerId\":" + customerId + "}", adminToken);
        assertThat(opened.status()).isEqualTo(201);
        assertThat(result(opened).get("openingPoints").asInt()).isEqualTo(1000);
        Resp duplicateOpening = call("POST", "/api/v1/quan-tri/thanh-vien/mo-dau",
                "{\"customerId\":" + customerId + "}", adminToken);
        assertThat(duplicateOpening.status()).isEqualTo(409);
        assertThat(json(duplicateOpening).get("code").asInt()).isEqualTo(4205);
        assertThat(json(call("POST", "/api/v1/cart/quote", "{\"redeemedPoints\":1}", customerToken))
                .get("code").asInt()).isEqualTo(4203);

        Resp enabledPolicy = call("PUT", "/api/v1/thanh-vien/chinh-sach/" + policyId,
                "{\"version\":1,\"earnCurrencyPerPoint\":25000,\"redeemCurrencyPerPoint\":1000,\"status\":\"ENABLED\"}", adminToken);
        assertThat(enabledPolicy.status()).isEqualTo(200);
        assertThat(result(enabledPolicy).get("version").asLong()).isEqualTo(2);
        Resp stalePolicy = call("PUT", "/api/v1/thanh-vien/chinh-sach/" + policyId,
                "{\"version\":1,\"earnCurrencyPerPoint\":25000,\"redeemCurrencyPerPoint\":1000,\"status\":\"DISABLED\"}", adminToken);
        assertThat(stalePolicy.status()).isEqualTo(409);
        assertThat(json(stalePolicy).get("code").asInt()).isEqualTo(4206);

        MembershipTier tier = tierRepository.findAll().stream().min(Comparator.comparing(MembershipTier::getId)).orElseThrow();
        Resp updatedTier = call("PUT", "/api/v1/thanh-vien/chinh-sach/hang/" + tier.getId(),
                "{\"version\":" + tier.getSalesTierVersion() + ",\"minimumCumulativePaidSales\":100000}", adminToken);
        assertThat(updatedTier.status()).isEqualTo(200);
        assertThat(result(updatedTier).get("minimumCumulativePaidSales").decimalValue()).isEqualByComparingTo("100000.00");
        customer.setSalesHistoryComplete(true);
        customerRepository.saveAndFlush(customer);

        Resp firstQuote = call("POST", "/api/v1/cart/quote", "{\"redeemedPoints\":2}", customerToken);
        assertThat(firstQuote.cacheControl()).contains("no-store");
        JsonNode quote = result(firstQuote);
        assertThat(quote.get("pointsDiscount").decimalValue()).isEqualByComparingTo("2000.00");
        assertThat(quote.get("merchandiseAmountDue").decimalValue()).isEqualByComparingTo("98000.00");
        String firstCheckoutBody = loyaltyCheckoutBody(quote, "loyalty-cancel-" + suffix, "First address");
        Resp firstCheckout = call("POST", "/api/v1/orders/checkout", firstCheckoutBody, customerToken);
        assertThat(firstCheckout.status()).isEqualTo(201);
        long firstOrderId = result(firstCheckout).get("orderId").asLong();
        JsonNode heldBalance = result(call("GET", "/api/v1/thanh-vien", null, customerToken));
        assertThat(heldBalance.get("heldPoints").asInt()).isEqualTo(2);
        assertThat(heldBalance.get("availablePoints").asInt()).isEqualTo(998);
        assertThat(call("POST", "/api/v1/orders/" + firstOrderId + "/cancel",
                "{\"reason\":\"release points hold\"}", customerToken).status()).isEqualTo(200);
        assertThat(call("POST", "/api/v1/orders/" + firstOrderId + "/cancel",
                "{\"reason\":\"duplicate release\"}", customerToken).status()).isEqualTo(400);
        JsonNode releasedBalance = result(call("GET", "/api/v1/thanh-vien", null, customerToken));
        assertThat(releasedBalance.get("heldPoints").asInt()).isZero();
        assertThat(releasedBalance.get("availablePoints").asInt()).isEqualTo(1000);

        assertThat(call("POST", "/api/v1/cart/items", "{\"skuId\":" + skuId + ",\"quantity\":1}", customerToken).status()).isEqualTo(200);
        JsonNode settlementQuote = result(call("POST", "/api/v1/cart/quote", "{\"redeemedPoints\":2}", customerToken));
        Resp settlementCheckout = call("POST", "/api/v1/orders/checkout",
                loyaltyCheckoutBody(settlementQuote, "loyalty-settle-" + suffix, "Settlement address"), customerToken);
        assertThat(settlementCheckout.status()).isEqualTo(201);
        long orderId = result(settlementCheckout).get("orderId").asLong();
        for (String status : new String[]{"CONFIRMED", "PACKING", "SHIPPING"}) {
            assertThat(updateStatus(orderId, status).status()).isEqualTo(200);
        }
        Resp payment = call("POST", "/api/v1/payments/process",
                paymentBody(orderId, new BigDecimal("103000")), staffToken);
        assertThat(payment.status()).isEqualTo(201);
        JsonNode receipt = result(payment);
        assertThat(receipt.get("earnedPoints").asInt()).isEqualTo(4);
        assertThat(receipt.get("redeemedPoints").asInt()).isEqualTo(2);
        assertThat(receipt.get("pointsDiscount").decimalValue()).isEqualByComparingTo("2000.00");
        assertThat(updateStatus(orderId, "COMPLETED").status()).isEqualTo(200);

        JsonNode finalBalance = result(call("GET", "/api/v1/thanh-vien", null, customerToken));
        assertThat(finalBalance.get("balancePoints").asInt()).isEqualTo(1002);
        assertThat(finalBalance.get("heldPoints").asInt()).isZero();
        assertThat(finalBalance.get("cumulativePaidSales").decimalValue()).isEqualByComparingTo("103000.00");
        assertThat(finalBalance.get("salesTierId").asLong()).isEqualTo(tier.getId());
        Resp profile = call("GET", "/api/v1/users/customers/" + customerId, null, customerToken);
        assertThat(profile.status()).isEqualTo(200);
        assertThat(result(profile).get("cumulativePaidSales").decimalValue()).isEqualByComparingTo("103000.00");
        assertThat(result(profile).get("salesTierId").asLong()).isEqualTo(tier.getId());
        assertThat(call("GET", "/api/v1/thanh-vien/khach-hang/" + customerId, null, staffToken).status()).isEqualTo(200);

        JsonNode ledger = result(call("GET", "/api/v1/thanh-vien/lich-su?page=0&size=100", null, customerToken));
        assertThat(ledger.get("content")).hasSize(6);
        assertThat(ledger.get("content").findValuesAsText("type"))
                .contains("OPENING", "HOLD", "RELEASE", "REDEEM", "EARN");
    }

    @Test
    void posQuotePaymentReplayConsumesAndEarnsPointsExactlyOnce() throws Exception {
        String staffToken = token("nhanvien1", "STAFF");
        Customer customer = customerRepository.findById(customerId).orElseThrow();
        customer.setSalesHistoryComplete(true);
        customerRepository.saveAndFlush(customer);
        Resp createdPolicy = call("POST", "/api/v1/thanh-vien/chinh-sach",
                "{\"earnCurrencyPerPoint\":25000,\"redeemCurrencyPerPoint\":1000,\"status\":\"ENABLED\"}", adminToken);
        assertThat(createdPolicy.status()).isEqualTo(201);
        assertThat(call("POST", "/api/v1/quan-tri/thanh-vien/mo-dau",
                "{\"customerId\":" + customerId + "}", adminToken).status()).isEqualTo(201);

        String phone = customer.getPhoneNumber();
        Resp draft = call("POST", "/api/v1/orders/pos/draft",
                "{\"customerPhone\":\"" + phone + "\",\"items\":[{\"skuId\":" + skuId + ",\"quantity\":1}]}", staffToken);
        assertThat(draft.status()).isEqualTo(201);
        long orderId = result(draft).get("orderId").asLong();
        assertThat(call("POST", "/api/v1/orders/pos/" + orderId + "/quote",
                "{\"redeemedPoints\":2}", customerToken).status()).isEqualTo(403);
        Resp posQuote = call("POST", "/api/v1/orders/pos/" + orderId + "/quote",
                "{\"redeemedPoints\":2}", staffToken);
        assertThat(posQuote.status()).isEqualTo(200);
        JsonNode quote = result(posQuote);
        assertThat(quote.get("orderId").asLong()).isEqualTo(orderId);
        assertThat(quote.get("pointsDiscount").decimalValue()).isEqualByComparingTo("2000.00");
        String fingerprint = quote.get("quoteFingerprint").asText();
        String paymentBody = pointsPaymentBody(orderId, new BigDecimal("98000"), 2, fingerprint);
        Resp payment = call("POST", "/api/v1/payments/process", paymentBody, staffToken);
        assertThat(payment.status()).isEqualTo(201);
        JsonNode receipt = result(payment);
        assertThat(receipt.get("earnedPoints").asInt()).isEqualTo(3);
        assertThat(receipt.get("pointsDiscount").decimalValue()).isEqualByComparingTo("2000.00");

        Resp replay = call("POST", "/api/v1/payments/process", paymentBody, staffToken);
        assertThat(replay.status()).isEqualTo(200);
        assertThat(result(replay).get("invoiceId").asLong()).isEqualTo(receipt.get("invoiceId").asLong());
        Resp conflict = call("POST", "/api/v1/payments/process",
                pointsPaymentBody(orderId, new BigDecimal("98001"), 2, fingerprint), staffToken);
        assertThat(conflict.status()).isEqualTo(409);
        assertThat(json(conflict).get("code").asInt()).isEqualTo(4108);

        JsonNode balance = result(call("GET", "/api/v1/thanh-vien", null, customerToken));
        assertThat(balance.get("balancePoints").asInt()).isEqualTo(1001);
        assertThat(balance.get("heldPoints").asInt()).isZero();
        assertThat(balance.get("cumulativePaidSales").decimalValue()).isEqualByComparingTo("98000.00");
        JsonNode entries = result(call("GET", "/api/v1/thanh-vien/lich-su?page=0&size=100", null, customerToken)).get("content");
        List<String> orderEntries = new ArrayList<>();
        for (JsonNode entry : entries) {
            if (entry.get("orderId").asLong() == orderId) orderEntries.add(entry.get("type").asText());
        }
        assertThat(orderEntries).containsExactlyInAnyOrder("HOLD", "REDEEM", "EARN");
    }

    private void disableActiveLoyaltyPolicyIfPresent() throws Exception {
        JsonNode policies = result(call("GET", "/api/v1/thanh-vien/chinh-sach?page=0&size=100", null, adminToken)).get("content");
        for (JsonNode policy : policies) {
            if ("ENABLED".equals(policy.path("status").asText())) {
                String body = "{\"version\":" + policy.get("version").asLong()
                        + ",\"earnCurrencyPerPoint\":" + policy.get("earnCurrencyPerPoint").asText()
                        + ",\"redeemCurrencyPerPoint\":" + policy.get("redeemCurrencyPerPoint").asText()
                        + ",\"status\":\"DISABLED\"}";
                Resp disabled = call("PUT", "/api/v1/thanh-vien/chinh-sach/" + policy.get("policyId").asLong(), body, adminToken);
                assertThat(disabled.status()).isEqualTo(200);
                return;
            }
        }
    }

    private String loyaltyCheckoutBody(JsonNode quote, String key, String address) {
        return "{\"deliveryAddress\":\"" + address + "\",\"shippingFee\":5000,\"paymentMethod\":\"COD\",\"redeemedPoints\":2"
                + ",\"quoteFingerprint\":\"" + quote.get("quoteFingerprint").asText()
                + "\",\"expectedMerchandiseAmountDue\":" + quote.get("merchandiseAmountDue").asText()
                + ",\"checkoutKey\":\"" + key + "\"}";
    }

    private String pointsPaymentBody(long orderId, BigDecimal amount, int points, String fingerprint) {
        return "{\"orderId\":" + orderId + ",\"paymentMethodCode\":\"CASH\",\"amountPaid\":" + amount
                + ",\"redeemedPoints\":" + points + ",\"quoteFingerprint\":\"" + fingerprint + "\"}";
    }

    private void assertOrderListDetailParity(long orderId, Long voucherId, String code, String campaignName,
            Long campaignVersion) throws Exception {
        Resp detailResponse = call("GET", "/api/v1/orders/" + orderId, null, customerToken);
        assertThat(detailResponse.status()).isEqualTo(200);
        JsonNode detail = result(detailResponse);
        String orderCode = URLEncoder.encode(detail.get("orderCode").asText(), StandardCharsets.UTF_8);
        Resp listResponse = call("GET", "/api/v1/orders?page=0&size=50&orderCode=" + orderCode, null, customerToken);
        assertThat(listResponse.status()).isEqualTo(200);
        JsonNode content = result(listResponse).get("content");
        assertThat(content).hasSize(1);
        JsonNode listOrder = content.get(0);
        assertThat(listOrder.get("orderId").asLong()).isEqualTo(orderId);
        assertThat(listOrder.get("voucherId")).isEqualTo(detail.get("voucherId"));
        assertThat(listOrder.get("voucherCode")).isEqualTo(detail.get("voucherCode"));
        assertThat(listOrder.get("voucherCampaignName")).isEqualTo(detail.get("voucherCampaignName"));
        assertThat(listOrder.get("voucherCampaignVersion")).isEqualTo(detail.get("voucherCampaignVersion"));
        assertThat(listOrder.get("totalAmount")).isEqualTo(detail.get("totalAmount"));
        assertThat(listOrder.get("discountAmount")).isEqualTo(detail.get("discountAmount"));
        if (voucherId == null) {
            assertThat(listOrder.get("voucherId").isNull()).isTrue();
            assertThat(listOrder.get("voucherCode").isNull()).isTrue();
            assertThat(listOrder.get("voucherCampaignName").isNull()).isTrue();
            assertThat(listOrder.get("voucherCampaignVersion").isNull()).isTrue();
        } else {
            assertThat(listOrder.get("voucherId").asLong()).isEqualTo(voucherId);
            assertThat(listOrder.get("voucherCode").asText()).isEqualTo(code);
            assertThat(listOrder.get("voucherCampaignName").asText()).isEqualTo(campaignName);
            assertThat(listOrder.get("voucherCampaignVersion").asLong()).isEqualTo(campaignVersion);
        }
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

    @Test
    void freeShippingUsesRealVoucherLifecycleAndPersistsDeliverySnapshot() throws Exception {
        String start = LocalDateTime.now().minusHours(1).toString();
        String end = LocalDateTime.now().plusDays(1).toString();
        Resp created = call("POST", "/api/v1/khuyen-mai",
            "{\"tenCtkm\":\"Ship " + suffix + "\",\"loaiGiam\":\"FREE_SHIP\",\"giaTriGiam\":1,\"ngayBatDau\":\""+start+"\",\"ngayKetThuc\":\""+end+"\"}", token("nhanvien1","STAFF"));
        assertThat(created.status()).isEqualTo(201);
        long id=result(created).get("maKm").asLong();
        assertThat(call("PUT","/api/v1/khuyen-mai/"+id,"{\"phienBan\":0,\"trangThai\":\"HOAT_DONG\"}",adminToken).status()).isEqualTo(200);
        String code="SHIP"+suffix.toUpperCase(java.util.Locale.ROOT);
        assertThat(call("POST","/api/v1/khuyen-mai/"+id+"/codes","{\"maCode\":\""+code+"\",\"soLuongPhatHanh\":10}",adminToken).status()).isEqualTo(201);
        String location="\"province\":\"TP. HCM\",\"district\":\"Tan Phu\",\"totalWeightGram\":300,\"deliveryLatitude\":10.8070354,\"deliveryLongitude\":106.6287031";
        JsonNode near=result(call("POST","/api/v1/orders/calculate-shipping-fee","{"+location+"}",customerToken));
        assertThat(near.get("shippingFee").decimalValue()).isEqualByComparingTo("15000");
        JsonNode far=result(call("POST","/api/v1/orders/calculate-shipping-fee","{"+location.replace("10.8070354","10.95")+"}",customerToken));
        assertThat(far.get("shippingFee").decimalValue()).isGreaterThan(near.get("shippingFee").decimalValue());
        JsonNode ship=result(call("POST","/api/v1/orders/calculate-shipping-fee","{"+location+",\"voucherCode\":\""+code+"\"}",customerToken));
        assertThat(ship.get("shippingFee").decimalValue()).isZero();
        JsonNode q=result(call("POST","/api/v1/cart/quote","{\"voucherCode\":\""+code+"\"}",customerToken));
        assertThat(q.get("freeShipping").asBoolean()).isTrue();
        assertThat(q.get("voucherDiscount").decimalValue()).isZero();
        String body="{\"deliveryAddress\":\"140 Le Trong Tan\",\"deliveryLatitude\":10.8070354,\"deliveryLongitude\":106.6287031,\"paymentMethod\":\"COD\",\"shippingFee\":0,\"voucherCode\":\""+code+"\",\"quoteFingerprint\":\""+q.get("quoteFingerprint").asText()+"\",\"expectedMerchandiseAmountDue\":"+q.get("merchandiseAmountDue").asText()+",\"checkoutKey\":\"ship-"+suffix+"\"}";
        Resp checkout=call("POST","/api/v1/orders/checkout",body,customerToken);
        assertThat(checkout.status()).as(checkout.body()).isEqualTo(201);
        long orderId=result(checkout).get("orderId").asLong();
        Order order=orderRepository.findById(orderId).orElseThrow();
        assertThat(order.getDeliveryLatitude()).isEqualTo(10.8070354);
        assertThat(order.getShippingFee()).isZero();
        assertThat(order.getVoucherDiscountType()).isEqualTo("FREE_SHIP");
        assertThat(usageStatus(orderId)).isEqualTo("HELD");
        assertThat(call("POST","/api/v1/orders/"+orderId+"/cancel","{\"reason\":\"Shipping test\"}",customerToken).status()).isEqualTo(200);
        assertThat(usageStatus(orderId)).isEqualTo("RELEASED");
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

    private record Resp(int status, String body, String cacheControl) {
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
            return new Resp(response.statusCode(), response.body(), response.headers().firstValue("Cache-Control").orElse(""));
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
