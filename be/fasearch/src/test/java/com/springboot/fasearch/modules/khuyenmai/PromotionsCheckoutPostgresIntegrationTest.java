package com.springboot.fasearch.modules.khuyenmai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;
import com.springboot.fasearch.modules.khuyenmai.entity.KhuyenMai;
import com.springboot.fasearch.modules.khuyenmai.entity.MaGiamGia;
import com.springboot.fasearch.modules.khuyenmai.repository.KhuyenMaiRepository;
import com.springboot.fasearch.modules.khuyenmai.repository.MaGiamGiaRepository;
import com.springboot.fasearch.modules.khuyenmai.repository.VoucherUsageRepository;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.loyalty.dto.request.LegacyOpeningRequest;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyCreateRequest;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyLedgerEntry;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyHoldStatus;
import com.springboot.fasearch.modules.loyalty.repository.LoyaltyLedgerRepository;
import com.springboot.fasearch.modules.loyalty.repository.LoyaltyOrderHoldRepository;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.order.dto.request.CartItemUpdateReq;
import com.springboot.fasearch.modules.order.entity.Cart;
import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.entity.OrderDetailId;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.service.interfaces.CartService;
import com.springboot.fasearch.modules.payment.dto.request.PaymentProcessReq;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentRepository;
import com.springboot.fasearch.modules.payment.service.interfaces.PaymentService;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;

@SpringBootTest
class PromotionsCheckoutPostgresIntegrationTest {
    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String database = System.getenv("PROMOTION_TEST_DB_NAME");
        if (database == null || database.isBlank()) {
            throw new IllegalStateException("Set PROMOTION_TEST_DB_NAME to the isolated candidate database before running PostgreSQL tests");
        }
        registry.add("spring.datasource.url", () -> "jdbc:postgresql://"
                + env("PROMOTION_TEST_DB_HOST", "127.0.0.1") + ":"
                + env("PROMOTION_TEST_DB_PORT", "55440") + "/" + database);
        registry.add("spring.datasource.username", () -> env("PROMOTION_TEST_DB_USER", "fasearch"));
        registry.add("spring.datasource.password", () -> env("PROMOTION_TEST_DB_PASSWORD", ""));
        registry.add("spring.datasource.hikari.maximum-pool-size", () -> "2");
        registry.add("spring.datasource.hikari.minimum-idle", () -> "0");
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    @Autowired private CheckoutBenefitService benefits;
    @Autowired private LoyaltyService loyaltyService;
    @Autowired private LoyaltyLedgerRepository loyaltyLedgerRepository;
    @Autowired private LoyaltyOrderHoldRepository loyaltyHoldRepository;
    @Autowired private KhuyenMaiRepository campaignRepository;
    @Autowired private MaGiamGiaRepository codeRepository;
    @Autowired private VoucherUsageRepository usageRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ProductVariantRepository variantRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private PaymentService paymentService;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private PaymentRepository paymentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private AccountRepository accountRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private CartRepository cartRepository;
    @Autowired private CartItemRepository cartItemRepository;
    @Autowired private CartService cartService;
    @Autowired private InventoryRepository inventoryRepository;

    @Test
    void lastQuotaRaceAndRepeatedReleaseAreAtomicOnPostgres() throws Exception {
        Fixture fixture = fixture(1);
        CartQuoteResponse quote = benefits.quote(List.of(CartItem.builder()
                .variant(fixture.variant()).quantity(1).build()), fixture.code());
        assertThat(quote.getVoucherDiscount()).isEqualByComparingTo("10.00");
        Order first = newOrder(fixture.suffix() + "-A");
        Order second = newOrder(fixture.suffix() + "-B");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var a = pool.submit(() -> hold(tx, start, first, fixture, quote));
            var b = pool.submit(() -> hold(tx, start, second, fixture, quote));
            start.countDown();
            List<String> results = List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
            assertThat(results).containsExactlyInAnyOrder("HELD", "VOUCHER_EXHAUSTED");
        } finally {
            pool.shutdownNow();
        }
        assertThat(codeRepository.findById(fixture.voucher().getId()).orElseThrow().getHeld()).isEqualTo(1);

        Long heldOrder = usageRepository.findAll().stream()
                .filter(row -> row.getVoucherId().equals(fixture.voucher().getId()))
                .findFirst().orElseThrow().getOrderId();
        tx.executeWithoutResult(status -> {
            benefits.release(heldOrder);
            benefits.release(heldOrder);
        });
        assertThat(codeRepository.findById(fixture.voucher().getId()).orElseThrow().getHeld()).isZero();
        assertThat(usageRepository.findById(heldOrder).orElseThrow().getStatus()).isEqualTo("RELEASED");
    }

    @Test
    void lateFailureRollsBackVoucherCounterAndUsageOnPostgres() {
        Fixture fixture = fixture(5);
        CartQuoteResponse quote = benefits.quote(List.of(CartItem.builder()
                .variant(fixture.variant()).quantity(1).build()), fixture.code());
        Order order = newOrder(fixture.suffix() + "-ROLLBACK");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            var application = benefits.prepareCheckout(List.of(detail(fixture.variant())), fixture.code(),
                    quote.getQuoteFingerprint(), quote.getMerchandiseAmountDue());
            benefits.recordHold(order.getId(), application);
            throw new IllegalStateException("simulate later order/stock failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(codeRepository.findById(fixture.voucher().getId()).orElseThrow().getHeld()).isZero();
        assertThat(usageRepository.findById(order.getId())).isEmpty();
    }

    @Test
    void concurrentCashCollectionConsumesVoucherOnlyOnceAndDoesNotRunLegacyPoints() throws Exception {
        Fixture fixture = fixture(3);
        CartQuoteResponse quote = benefits.quote(List.of(CartItem.builder()
                .variant(fixture.variant()).quantity(1).build()), fixture.code());
        Customer customer = userRepository.findByAccount_Username("khachhang1").orElseThrow();
        int pointsBefore = customer.getAccumulatePoint();
        Order order = orderRepository.saveAndFlush(Order.builder().orderCode("PROMO-SETTLE-" + fixture.suffix())
                .customer(customer).status(OrderStatus.SHIPPING).shippingFee(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO).totalAmount(quote.getMerchandiseAmountDue())
                .isDeleted(false).build());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            Order locked = orderRepository.findByIdForUpdate(order.getId()).orElseThrow();
            var application = benefits.prepareCheckout(List.of(detail(fixture.variant())), fixture.code(),
                    quote.getQuoteFingerprint(), quote.getMerchandiseAmountDue());
            benefits.applySnapshot(locked, application);
            orderRepository.save(locked);
            benefits.recordHold(locked.getId(), application);
        });

        try {
            SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                    "khachhang1", null, List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER"))));
            paymentService.processPayment(PaymentProcessReq.builder().orderId(order.getId())
                    .paymentMethodCode(PaymentMethodType.CASH).amountPaid(quote.getMerchandiseAmountDue()).build());
            throw new AssertionError("customer must not collect voucher COD");
        } catch (AppException denied) {
            assertThat(denied.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        } finally {
            SecurityContextHolder.clearContext();
        }
        assertThat(invoiceRepository.findByOrderId(order.getId())).isEmpty();
        assertThat(usageRepository.findById(order.getId()).orElseThrow().getStatus()).isEqualTo("HELD");

        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var a = pool.submit(() -> settle(order.getId(), quote.getMerchandiseAmountDue(), start));
            var b = pool.submit(() -> settle(order.getId(), quote.getMerchandiseAmountDue(), start));
            start.countDown();
            List<String> results = List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
            assertThat(results).containsExactlyInAnyOrder("PAID", "ORDER_ALREADY_PAID");
        } finally {
            pool.shutdownNow();
            SecurityContextHolder.clearContext();
        }

        var invoice = invoiceRepository.findByOrderId(order.getId()).orElseThrow();
        assertThat(invoice.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(paymentRepository.findByInvoiceId(invoice.getId())).hasSize(1);
        assertThat(codeRepository.findById(fixture.voucher().getId()).orElseThrow().getUsed()).isEqualTo(1);
        assertThat(codeRepository.findById(fixture.voucher().getId()).orElseThrow().getHeld()).isZero();
        assertThat(usageRepository.findById(order.getId()).orElseThrow().getStatus()).isEqualTo("CONSUMED");
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getAccumulatePoint()).isEqualTo(pointsBefore);
    }

    @Test
    void zeroDueCodWritesPaidInvoiceWithoutPaymentRow() {
        Fixture fixture = fixture(3, "SO_TIEN", new BigDecimal("100.00"));
        CartQuoteResponse quote = benefits.quote(List.of(CartItem.builder()
                .variant(fixture.variant()).quantity(1).build()), fixture.code());
        assertThat(quote.getMerchandiseAmountDue()).isEqualByComparingTo("0.00");
        Customer customer = userRepository.findByAccount_Username("khachhang1").orElseThrow();
        Order order = orderRepository.saveAndFlush(Order.builder().orderCode("PROMO-ZERO-" + fixture.suffix())
                .customer(customer).status(OrderStatus.SHIPPING).shippingFee(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO).totalAmount(BigDecimal.ZERO).isDeleted(false).build());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            Order locked = orderRepository.findByIdForUpdate(order.getId()).orElseThrow();
            var application = benefits.prepareCheckout(List.of(detail(fixture.variant())), fixture.code(),
                    quote.getQuoteFingerprint(), quote.getMerchandiseAmountDue());
            benefits.applySnapshot(locked, application);
            orderRepository.save(locked);
            benefits.recordHold(locked.getId(), application);
        });

        settle(order.getId(), BigDecimal.ZERO, new CountDownLatch(0));
        var invoice = invoiceRepository.findByOrderId(order.getId()).orElseThrow();
        assertThat(invoice.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(invoice.getTotalActualPaid()).isEqualByComparingTo("0.00");
        assertThat(paymentRepository.findByInvoiceId(invoice.getId())).isEmpty();
        assertThat(codeRepository.findById(fixture.voucher().getId()).orElseThrow().getUsed()).isEqualTo(1);
    }

    @Test
    void cartMutationWaitsForCheckoutCartLockBeforeTouchingItems() throws Exception {
        Fixture fixture = fixture(1);
        String suffix = Long.toString(System.nanoTime(), 36);
        Role customerRole = roleRepository.findByName(RoleType.CUSTOMER).orElseThrow();
        Account account = accountRepository.saveAndFlush(Account.builder().username("cart-lock-" + suffix)
                .password("not-used-in-test").email("cart-lock-" + suffix + "@example.invalid").role(customerRole)
                .status(AccountStatus.ACTIVE).isDeleted(false).build());
        Customer customer = userRepository.saveAndFlush(Customer.builder().firstName("Cart").lastName("Lock")
                .phoneNumber("08" + String.format("%08d", Math.floorMod(System.nanoTime(), 100_000_000L)))
                .address("Synthetic test address").accumulatePoint(0).account(account).isDeleted(false).build());
        Cart cart = cartRepository.saveAndFlush(Cart.builder().customer(customer).totalItems(1).build());
        cartItemRepository.saveAndFlush(CartItem.builder().cart(cart).variant(fixture.variant()).quantity(1).build());
        inventoryRepository.saveAndFlush(Inventory.builder().variant(fixture.variant()).physicalStock(5)
                .reservedStock(0).availableStock(5).minThreshold(1).isDeleted(false).build());

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch cartLocked = new CountDownLatch(1);
        CountDownLatch mutationStarted = new CountDownLatch(1);
        CountDownLatch finishCheckout = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var checkout = pool.submit(() -> tx.executeWithoutResult(status -> {
                Cart locked = cartRepository.findByCustomerIdForUpdate(customer.getId()).orElseThrow();
                cartLocked.countDown();
                try {
                    if (!finishCheckout.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("checkout lock test timed out");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(e);
                }
                cartItemRepository.deleteAllByCartId(locked.getId());
                locked.setTotalItems(0);
            }));
            assertThat(cartLocked.await(10, TimeUnit.SECONDS)).isTrue();
            var mutation = pool.submit(() -> {
                mutationStarted.countDown();
                SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                        account.getUsername(), null, List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER"))));
                try {
                    cartService.updateItemQuantity(fixture.variant().getId(), CartItemUpdateReq.builder().quantity(2).build());
                    return "UPDATED";
                } catch (AppException e) {
                    return e.getErrorCode().name();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            });

            assertThat(mutationStarted.await(10, TimeUnit.SECONDS)).isTrue();
            Thread.sleep(300);
            assertThat(mutation.isDone()).as("cart mutation waits on the checkout parent-row lock").isFalse();
            finishCheckout.countDown();
            checkout.get(10, TimeUnit.SECONDS);
            assertThat(mutation.get(10, TimeUnit.SECONDS)).isEqualTo(ErrorCode.CART_ITEM_NOT_FOUND.name());
        } finally {
            finishCheckout.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void openingHoldInvoiceSettlementAndReplayAreAtomicOnPostgres() {
        Customer customer = loyaltyCustomer(20);
        LegacyOpeningRequest opening = new LegacyOpeningRequest();
        opening.setCustomerId(customer.getId());
        var opened = loyaltyService.openLegacyBalance(opening);
        assertThat(opened.getOpeningPoints()).isEqualTo(20);
        assertThatThrownBy(() -> loyaltyService.openLegacyBalance(opening))
                .isInstanceOfSatisfying(AppException.class, error ->
                        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.OPENING_ALREADY_RECORDED));

        createEnabledPolicy("25.00", "10.00");
        Fixture fixture = fixture(2);
        CartQuoteResponse quote = benefits.quote(List.of(CartItem.builder()
                .variant(fixture.variant()).quantity(1).build()), customer.getId(), null, 5);
        assertThat(quote.getMerchandiseAmountDue()).isEqualByComparingTo("50.00");
        Order order = loyaltyOrder("SETTLE", customer, fixture.variant(), quote.getMerchandiseAmountDue());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> prepareLoyaltyHold(tx, order.getId(), customer, quote, 5));
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getHeldPoints()).isEqualTo(5);

        try {
            SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                    "nhanvien1", null, List.of(new SimpleGrantedAuthority("ROLE_STAFF"))));
            var payment = paymentService.processPayment(PaymentProcessReq.builder().orderId(order.getId())
                    .paymentMethodCode(PaymentMethodType.CASH).amountPaid(quote.getMerchandiseAmountDue()).build());
            assertThat(payment.replayed()).isFalse();
            assertThat(payment.receipt().getRedeemedPoints()).isEqualTo(5);
            assertThat(payment.receipt().getPointsDiscount()).isEqualByComparingTo("50.00");
            assertThat(payment.receipt().getEarnedPoints()).isEqualTo(2);
        } finally {
            SecurityContextHolder.clearContext();
        }

        Order settled = orderRepository.findById(order.getId()).orElseThrow();
        assertThat(settled.getEarnedPoints()).isEqualTo(2);
        assertThat(loyaltyHoldRepository.findById(order.getId()).orElseThrow().getStatus())
                .isEqualTo(LoyaltyHoldStatus.CONSUMED);
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getAccumulatePoint()).isEqualTo(17);
        List<LoyaltyLedgerEntry> entries = loyaltyLedgerRepository.findByCustomer_IdOrderByOccurredAtDescIdDesc(
                customer.getId(), PageRequest.of(0, 20)).getContent();
        assertThat(entries).extracting(LoyaltyLedgerEntry::getType)
                .containsExactlyInAnyOrder(LoyaltyEntryType.OPENING, LoyaltyEntryType.HOLD,
                        LoyaltyEntryType.REDEEM, LoyaltyEntryType.EARN);

        tx.executeWithoutResult(status -> loyaltyService.settleOrder(
                orderRepository.findByIdForUpdate(order.getId()).orElseThrow(), new BigDecimal("1000.00")));
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getAccumulatePoint()).isEqualTo(17);
        assertThat(loyaltyService.customerBalance(customer.getId()).getCumulativePaidSales())
                .isEqualByComparingTo("50.00");
    }

    @Test
    void loyaltyHoldRaceAllowsOnlyAvailablePointsAndRollbackRestoresLedgerAndBalance() throws Exception {
        Customer customer = loyaltyCustomer(5);
        LegacyOpeningRequest opening = new LegacyOpeningRequest();
        opening.setCustomerId(customer.getId());
        loyaltyService.openLegacyBalance(opening);
        createEnabledPolicy("25.00", "10.00");
        Fixture fixture = fixture(1);
        CartQuoteResponse quote = benefits.quote(List.of(CartItem.builder()
                .variant(fixture.variant()).quantity(1).build()), customer.getId(), null, 5);
        Order first = loyaltyOrder("RACE-A", customer, fixture.variant(), quote.getMerchandiseAmountDue());
        Order second = loyaltyOrder("RACE-B", customer, fixture.variant(), quote.getMerchandiseAmountDue());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var a = pool.submit(() -> holdPoints(tx, start, first, customer, quote));
            var b = pool.submit(() -> holdPoints(tx, start, second, customer, quote));
            start.countDown();
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("HELD", ErrorCode.INSUFFICIENT_POINTS.name());
        } finally {
            pool.shutdownNow();
        }
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getHeldPoints()).isEqualTo(5);

        Customer rollbackCustomer = loyaltyCustomer(10);
        LegacyOpeningRequest rollbackOpening = new LegacyOpeningRequest();
        rollbackOpening.setCustomerId(rollbackCustomer.getId());
        loyaltyService.openLegacyBalance(rollbackOpening);
        CartQuoteResponse rollbackQuote = benefits.quote(List.of(CartItem.builder()
                .variant(fixture.variant()).quantity(1).build()), rollbackCustomer.getId(), null, 4);
        Order rollbackOrder = loyaltyOrder("ROLLBACK", rollbackCustomer, fixture.variant(),
                rollbackQuote.getMerchandiseAmountDue());
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            prepareLoyaltyHold(tx, rollbackOrder.getId(), rollbackCustomer, rollbackQuote, 4);
            throw new IllegalStateException("force late transaction rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(userRepository.findById(rollbackCustomer.getId()).orElseThrow().getHeldPoints()).isZero();
        assertThat(loyaltyHoldRepository.findById(rollbackOrder.getId())).isEmpty();
        assertThat(loyaltyLedgerRepository.findByCustomer_IdOrderByOccurredAtDescIdDesc(
                rollbackCustomer.getId(), PageRequest.of(0, 20)).getContent())
                .extracting(LoyaltyLedgerEntry::getType).containsExactly(LoyaltyEntryType.OPENING);
        Order rolledBack = orderRepository.findById(rollbackOrder.getId()).orElseThrow();
        assertThat(rolledBack.getRedeemedPoints()).isZero();
        assertThat(rolledBack.getLoyaltyQuoteFingerprint()).isNull();
    }

    @Test
    void concurrentLegacySettlementsKeepEveryAwardAndOrderKeyedLedgerEntry() throws Exception {
        Customer customer = loyaltyCustomer(0);
        LegacyOpeningRequest opening = new LegacyOpeningRequest();
        opening.setCustomerId(customer.getId());
        loyaltyService.openLegacyBalance(opening);
        Fixture fixture = fixture(1);
        Order first = loyaltyOrder("LEGACY-A", customer, fixture.variant(), new BigDecimal("100000.00"));
        Order second = loyaltyOrder("LEGACY-B", customer, fixture.variant(), new BigDecimal("100000.00"));
        CountDownLatch start = new CountDownLatch(1);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var a = pool.submit(() -> legacySettle(tx, start, first));
            var b = pool.submit(() -> legacySettle(tx, start, second));
            start.countDown();
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)))
                    .containsExactly("SETTLED", "SETTLED");
        } finally {
            pool.shutdownNow();
            SecurityContextHolder.clearContext();
        }
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getAccumulatePoint()).isEqualTo(2);
        assertThat(loyaltyLedgerRepository.findByCustomer_IdOrderByOccurredAtDescIdDesc(
                customer.getId(), PageRequest.of(0, 20)).getContent())
                .extracting(LoyaltyLedgerEntry::getType)
                .containsExactlyInAnyOrder(LoyaltyEntryType.OPENING, LoyaltyEntryType.EARN, LoyaltyEntryType.EARN);
        assertThat(loyaltyLedgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), "earn:" + first.getId()))
                .isPresent();
        assertThat(loyaltyLedgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), "earn:" + second.getId()))
                .isPresent();
    }

    @Test
    void legacyEarnAfterOpeningAppendsSingleOrderKeyedEntryAndReplayIsIdempotent() {
        Customer customer = loyaltyCustomer(10);
        LegacyOpeningRequest opening = new LegacyOpeningRequest();
        opening.setCustomerId(customer.getId());
        loyaltyService.openLegacyBalance(opening);
        Fixture fixture = fixture(1);
        Order order = loyaltyOrder("LEGACY-REPLAY", customer, fixture.variant(), new BigDecimal("250000.00"));
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> loyaltyService.settleLegacyEarn(
                orderRepository.findByIdForUpdate(order.getId()).orElseThrow(), new BigDecimal("250000.00")));
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getAccumulatePoint()).isEqualTo(12);
        assertThat(loyaltyLedgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), "earn:" + order.getId()))
                .isPresent();

        tx.executeWithoutResult(status -> loyaltyService.settleLegacyEarn(
                orderRepository.findByIdForUpdate(order.getId()).orElseThrow(), new BigDecimal("250000.00")));
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getAccumulatePoint()).isEqualTo(12);
        assertThat(loyaltyLedgerRepository.findByCustomer_IdOrderByOccurredAtDescIdDesc(
                customer.getId(), PageRequest.of(0, 20)).getContent())
                .extracting(LoyaltyLedgerEntry::getType)
                .containsExactlyInAnyOrder(LoyaltyEntryType.OPENING, LoyaltyEntryType.EARN);
    }

    @Test
    void legacyEarnOverflowReturns4208AndRollsBackInvoiceAndPayment() {
        Customer customer = loyaltyCustomer(Integer.MAX_VALUE - 1);
        Fixture fixture = fixture(1);
        Order order = loyaltyOrder("LEGACY-OVERFLOW", customer, fixture.variant(), new BigDecimal("1000000.00"));
        long paymentsBefore = paymentRepository.count();
        try {
            SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                    "nhanvien1", null, List.of(new SimpleGrantedAuthority("ROLE_STAFF"))));
            assertThatThrownBy(() -> paymentService.processPayment(PaymentProcessReq.builder()
                    .orderId(order.getId()).paymentMethodCode(PaymentMethodType.CASH)
                    .amountPaid(new BigDecimal("1000000.00")).build()))
                    .isInstanceOfSatisfying(AppException.class, error ->
                            assertThat(error.getErrorCode()).isEqualTo(ErrorCode.LOYALTY_STATE_CONFLICT));
        } finally {
            SecurityContextHolder.clearContext();
        }
        assertThat(invoiceRepository.findByOrderId(order.getId())).isEmpty();
        assertThat(paymentRepository.count()).isEqualTo(paymentsBefore);
        assertThat(userRepository.findById(customer.getId()).orElseThrow().getAccumulatePoint())
                .isEqualTo(Integer.MAX_VALUE - 1);
        assertThat(orderRepository.findById(order.getId()).orElseThrow().getStatus()).isEqualTo(OrderStatus.SHIPPING);
        assertThat(loyaltyLedgerRepository.findByCustomer_IdOrderByOccurredAtDescIdDesc(
                customer.getId(), PageRequest.of(0, 20)).getContent()).isEmpty();
    }

    private String legacySettle(TransactionTemplate tx, CountDownLatch start, Order order) {
        try {
            start.await(10, TimeUnit.SECONDS);
            return tx.execute(status -> {
                loyaltyService.settleLegacyEarn(
                        orderRepository.findByIdForUpdate(order.getId()).orElseThrow(),
                        new BigDecimal("100000.00"));
                return "SETTLED";
            });
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void createEnabledPolicy(String earnRate, String redeemRate) {
        LoyaltyPolicyCreateRequest request = new LoyaltyPolicyCreateRequest();
        request.setEarnCurrencyPerPoint(new BigDecimal(earnRate));
        request.setRedeemCurrencyPerPoint(new BigDecimal(redeemRate));
        request.setStatus("ENABLED");
        loyaltyService.createPolicy(request);
        assertThat(loyaltyService.policies(0, 100).getContent())
                .filteredOn(policy -> "ENABLED".equals(policy.getStatus())).hasSize(1);
    }

    private Customer loyaltyCustomer(int points) {
        String suffix = Long.toString(System.nanoTime(), 36);
        Role customerRole = roleRepository.findByName(RoleType.CUSTOMER).orElseThrow();
        Account account = accountRepository.saveAndFlush(Account.builder().username("s2-loyalty-" + suffix)
                .password("not-used-in-test").email("s2-loyalty-" + suffix + "@example.invalid")
                .role(customerRole).status(AccountStatus.ACTIVE).isDeleted(false).build());
        return userRepository.saveAndFlush(Customer.builder().firstName("S2").lastName("Loyalty")
                .phoneNumber("08" + String.format("%08d", Math.floorMod(System.nanoTime(), 100_000_000L)))
                .address("Synthetic test address").accumulatePoint(points).heldPoints(0)
                .salesHistoryComplete(true).account(account).isDeleted(false).build());
    }

    private Order loyaltyOrder(String label, Customer customer, ProductVariant variant, BigDecimal due) {
        OrderDetail line = detail(variant);
        Order order = Order.builder().orderCode("S2-LOYALTY-" + label + "-" + Long.toString(System.nanoTime(), 36))
                .customer(customer).status(OrderStatus.SHIPPING).shippingFee(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO).totalAmount(due).isDeleted(false)
                .details(new java.util.ArrayList<>(List.of(line))).build();
        line.setOrder(order);
        return orderRepository.saveAndFlush(order);
    }

    private void prepareLoyaltyHold(TransactionTemplate tx, Long orderId, Customer customer,
            CartQuoteResponse quote, int points) {
        Order order = orderRepository.findByIdForUpdate(orderId).orElseThrow();
        var application = benefits.prepareCheckout(order.getDetails(), customer.getId(), null, points,
                quote.getQuoteFingerprint(), quote.getMerchandiseAmountDue());
        for (OrderDetail line : order.getDetails()) {
            line.setDiscountAmount(application.discountBySku().getOrDefault(
                    line.getVariant().getId(), BigDecimal.ZERO.setScale(2)));
            line.setPointsDiscountAmount(application.loyaltyQuote().pointsDiscountBySku().getOrDefault(
                    line.getVariant().getId(), BigDecimal.ZERO.setScale(2)));
        }
        benefits.applySnapshot(order, application);
        order.setTotalAmount(quote.getMerchandiseAmountDue());
        orderRepository.save(order);
        benefits.recordHold(orderId, application);
    }

    private String holdPoints(TransactionTemplate tx, CountDownLatch start, Order order, Customer customer,
            CartQuoteResponse quote) {
        try {
            start.await(10, TimeUnit.SECONDS);
            return tx.execute(status -> {
                prepareLoyaltyHold(tx, order.getId(), customer, quote, 5);
                return "HELD";
            });
        } catch (AppException e) {
            return e.getErrorCode().name();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String settle(Long orderId, BigDecimal amount, CountDownLatch start) {
        try {
            start.await(10, TimeUnit.SECONDS);
            SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                    "nhanvien1", null, List.of(new SimpleGrantedAuthority("ROLE_STAFF"))));
            paymentService.processPayment(PaymentProcessReq.builder().orderId(orderId)
                    .paymentMethodCode(PaymentMethodType.CASH).amountPaid(amount).build());
            return "PAID";
        } catch (AppException e) {
            return e.getErrorCode().name();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private String hold(TransactionTemplate tx, CountDownLatch start, Order order, Fixture f, CartQuoteResponse quote) {
        try {
            start.await(10, TimeUnit.SECONDS);
            return tx.execute(status -> {
                var application = benefits.prepareCheckout(List.of(detail(f.variant())), f.code(),
                        quote.getQuoteFingerprint(), quote.getMerchandiseAmountDue());
                benefits.recordHold(order.getId(), application);
                return "HELD";
            });
        } catch (AppException e) {
            return e.getErrorCode().name();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private record Fixture(String suffix, ProductVariant variant, KhuyenMai campaign,
            MaGiamGia voucher, String code) {}

    private Fixture fixture(int quota) {
        return fixture(quota, "PHAN_TRAM", new BigDecimal("10.00"));
    }

    private Fixture fixture(int quota, String discountType, BigDecimal discountValue) {
        String suffix = Long.toString(System.nanoTime(), 36);
        Category category = categoryRepository.save(Category.builder()
                .categoryName("Promo category " + suffix).isDeleted(false).build());
        Product product = productRepository.save(Product.builder().productName("Promo item " + suffix)
                .category(category).price(new BigDecimal("100.00")).build());
        ProductVariant variant = variantRepository.save(ProductVariant.builder().product(product)
                .color("Blue").size("M").barcode("PROMO-" + suffix).isDeleted(false).build());
        LocalDateTime now = LocalDateTime.now();
        KhuyenMai campaign = campaignRepository.saveAndFlush(KhuyenMai.builder().name("Promo " + suffix)
                .discountType(discountType).discountValue(discountValue)
                .startAt(now.minusHours(1)).endAt(now.plusHours(1)).status("HOAT_DONG")
                .version(0L).productScope(Set.of(product.getId())).build());
        String code = ("P" + suffix).toUpperCase(java.util.Locale.ROOT);
        MaGiamGia voucher = codeRepository.saveAndFlush(MaGiamGia.builder().campaignId(campaign.getId())
                .code(code).issued(quota).used(0).held(0).status("ACTIVE").deleted(false).build());
        return new Fixture(suffix, variant, campaign, voucher, code);
    }

    private Order newOrder(String code) {
        return orderRepository.saveAndFlush(Order.builder().orderCode("PROMO-" + code)
                .status(OrderStatus.PENDING).shippingFee(BigDecimal.ZERO).discountAmount(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("100.00")).isDeleted(false).build());
    }

    private OrderDetail detail(ProductVariant variant) {
        return OrderDetail.builder().id(new OrderDetailId(null, variant.getId())).variant(variant)
                .quantity(1).unitPrice(new BigDecimal("100.00")).build();
    }
}
