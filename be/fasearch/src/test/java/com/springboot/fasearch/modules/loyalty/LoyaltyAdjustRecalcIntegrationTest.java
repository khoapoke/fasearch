package com.springboot.fasearch.modules.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.loyalty.dto.request.LegacyOpeningRequest;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyCreateRequest;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyUpdateRequest;
import com.springboot.fasearch.modules.loyalty.dto.request.PointsAdjustmentRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.AdminLedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.EarnRecalcResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.PointsAdjustmentResponse;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.order.repository.OrderRepository;

/**
 * S3: per-order EARN recalculation and manual ADJUST on a throwaway PostgreSQL (DEMO_TEST_DB_*).
 * Covers idempotency (twice; recalc then normal settlement; normal settlement then recalc), refusals,
 * the append-only trigger, signed ADJUST balance maths and the legacy-balance / no OPENING interplay.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class LoyaltyAdjustRecalcIntegrationTest {
    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:postgresql://" + env("DEMO_TEST_DB_HOST", "127.0.0.1") + ":"
                + env("DEMO_TEST_DB_PORT", "55440") + "/" + env("DEMO_TEST_DB_NAME", "fasearch_demo_integrated_20261030"));
        registry.add("spring.datasource.username", () -> env("DEMO_TEST_DB_USER", "fasearch"));
        registry.add("spring.datasource.password", () -> env("DEMO_TEST_DB_PASSWORD", ""));
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    @Autowired private LoyaltyService loyalty;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private OrderRepository orderRepository;
    @Autowired private PlatformTransactionManager txm;

    @AfterEach
    void clearAuth() { SecurityContextHolder.clearContext(); }

    private static void as(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "test_" + role.toLowerCase(), null, com.springboot.fasearch.security.TestAuthorities.forRole(role)));
    }

    private long id(String sql, Object... args) { return jdbc.queryForObject(sql, Long.class, args); }

    private long customer(int points) {
        return id("insert into khach_hang(ten_kh, ho_kh, diem_tich_luy) values ('Test', 'Loyalty', ?) returning ma_kh", points);
    }

    /** Order with a PAID invoice, no ledger rows. Policy columns are set only when a snapshot is requested. */
    private long paidOrder(long customer, String status, String paid, long[] snapshot) {
        long order = snapshot == null
                ? id("insert into don_hang(ma_kh, ngay_dat, trang_thai, tong_tien, ma_don) values (?, now(), ?, 1, ?) returning ma_don_hang",
                        customer, status, "S3-" + UUID.randomUUID().toString().substring(0, 8))
                : id("insert into don_hang(ma_kh, ngay_dat, trang_thai, tong_tien, ma_don, loyalty_policy_id, loyalty_policy_version, "
                        + "redeem_currency_per_point_snapshot, loyalty_quote_fingerprint) values (?, now(), ?, 1, ?, ?, ?, 1000, 'fp') returning ma_don_hang",
                        customer, status, "S3-" + UUID.randomUUID().toString().substring(0, 8), snapshot[0], snapshot[1]);
        jdbc.update("insert into hoa_don(ma_don_hang, ngay_lap, tong_tien_thuc_tra, trang_thai, payment_method_code) "
                + "values (?, now(), ?, 'PAID', 'CASH')", order, new BigDecimal(paid));
        return order;
    }

    private int balance(long customer) { return jdbc.queryForObject("select diem_tich_luy from khach_hang where ma_kh=?", Integer.class, customer); }
    private int rows(long customer, String type) {
        return jdbc.queryForObject("select count(*) from loyalty_ledger_entry where customer_id=? and entry_type=?", Integer.class, customer, type);
    }
    private long ledgerSum(long customer) {
        return jdbc.queryForObject("select coalesce(sum(case when entry_type in ('EARN','ADJUST','OPENING') then points "
                + "when entry_type='REDEEM' then -points else 0 end),0) from loyalty_ledger_entry where customer_id=?", Long.class, customer);
    }

    private long[] policy(String earn) {
        as("ADMIN");
        var req = new LoyaltyPolicyCreateRequest();
        req.setEarnCurrencyPerPoint(new BigDecimal(earn));
        req.setRedeemCurrencyPerPoint(new BigDecimal("1000"));
        req.setStatus("ENABLED");
        var p = loyalty.createPolicy(req);
        return new long[] { p.getPolicyId(), p.getVersion() };
    }

    /** Records the OPENING baseline for a customer (balance unchanged). */
    private void openingOf(long customer) {
        as("ADMIN");
        var open = new LegacyOpeningRequest();
        open.setCustomerId(customer);
        loyalty.openLegacyBalance(open);
    }

    private void legacySettle(long order, String paid) {
        new TransactionTemplate(txm).executeWithoutResult(s ->
                loyalty.settleLegacyEarn(orderRepository.findById(order).orElseThrow(), new BigDecimal(paid)));
    }

    private PointsAdjustmentRequest adjust(int delta, String reason, String note) {
        var r = new PointsAdjustmentRequest();
        r.setDelta(delta); r.setReasonCode(reason); r.setNote(note); r.setRequestId(UUID.randomUUID().toString());
        return r;
    }

    private static void refused(Runnable action, String reason) {
        assertThatThrownBy(action::run).isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrors().stream().map(d -> d.getReason()).toList()).contains(reason));
    }

    @Test
    void recalcLegacyOrderUsesCurrentPolicyAndIsIdempotent() {
        policy("25000");
        long c = customer(100);
        openingOf(c);
        long o = paidOrder(c, "COMPLETED", "500000.00", null);

        EarnRecalcResponse preview = loyalty.previewEarnRecalc(o);
        assertThat(preview.isEligible()).isTrue();
        assertThat(preview.getPoints()).isEqualTo(20);
        assertThat(preview.getPolicySource()).isEqualTo("CURRENT_POLICY");
        assertThat(preview.getBalanceBefore()).isEqualTo(100);
        assertThat(preview.getBalanceAfter()).isEqualTo(120);
        assertThat(rows(c, "EARN")).isZero();
        assertThat(balance(c)).isEqualTo(100);

        EarnRecalcResponse first = loyalty.recalculateEarn(o);
        assertThat(first.isApplied()).isTrue();
        assertThat(balance(c)).isEqualTo(120);
        assertThat(rows(c, "EARN")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select ly_do || '/' || nguoi_thuc_hien from loyalty_ledger_entry where source_key='earn:" + o + "'", String.class))
                .isEqualTo("TINH_LAI_DON/test_admin");
        assertThat(jdbc.queryForObject("select earned_points from don_hang where ma_don_hang=?", Integer.class, o)).isEqualTo(20);

        EarnRecalcResponse second = loyalty.recalculateEarn(o);
        assertThat(second.isApplied()).isFalse();
        assertThat(second.getReason()).isEqualTo("ALREADY_EARNED");
        assertThat(balance(c)).isEqualTo(120);
        assertThat(rows(c, "EARN")).isEqualTo(1);
        assertThat(loyalty.previewEarnRecalc(o).isEligible()).isFalse();

        // the normal settlement path after a recalculation must not credit again
        new TransactionTemplate(txm).executeWithoutResult(s ->
                loyalty.settleOrder(orderRepository.findById(o).orElseThrow(), new BigDecimal("500000.00")));
        assertThat(balance(c)).isEqualTo(120);
        assertThat(rows(c, "EARN")).isEqualTo(1);
    }

    @Test
    void normalSettlementThenRecalcDoesNotDoubleCreditAndSnapshotRateWins() {
        long[] v1 = policy("25000");
        long c = customer(0);
        long o = paidOrder(c, "COMPLETED", "300000.00", v1);
        // policy changes after the order was priced: the order keeps its own version
        as("ADMIN");
        var up = new LoyaltyPolicyUpdateRequest();
        up.setVersion(v1[1]); up.setEarnCurrencyPerPoint(new BigDecimal("50000"));
        up.setRedeemCurrencyPerPoint(new BigDecimal("1000")); up.setStatus("ENABLED");
        loyalty.updatePolicy(v1[0], up);

        EarnRecalcResponse preview = loyalty.previewEarnRecalc(o);
        assertThat(preview.getPolicySource()).isEqualTo("ORDER_SNAPSHOT");
        assertThat(preview.getPolicyVersion()).isEqualTo(v1[1]);
        assertThat(preview.getPoints()).isEqualTo(12);

        new TransactionTemplate(txm).executeWithoutResult(s ->
                loyalty.settleOrder(orderRepository.findById(o).orElseThrow(), new BigDecimal("300000.00")));
        assertThat(balance(c)).isEqualTo(12);
        EarnRecalcResponse after = loyalty.recalculateEarn(o);
        assertThat(after.isApplied()).isFalse();
        assertThat(after.getReason()).isEqualTo("ALREADY_EARNED");
        assertThat(balance(c)).isEqualTo(12);
        assertThat(rows(c, "EARN")).isEqualTo(1);
    }

    @Test
    void recalcRefusesIneligibleOrders() {
        policy("25000");
        long c = customer(0);
        openingOf(c);
        assertThat(loyalty.previewEarnRecalc(paidOrder(c, "CANCELLED", "500000.00", null)).getReason()).isEqualTo("STATUS");
        assertThat(loyalty.previewEarnRecalc(paidOrder(c, "COMPLETED", "10000.00", null)).getReason()).isEqualTo("ZERO_POINTS");
        long unpaid = id("insert into don_hang(ma_kh, ngay_dat, trang_thai, tong_tien, ma_don) values (?, now(), 'COMPLETED', 1, ?) returning ma_don_hang",
                c, "S3-" + UUID.randomUUID().toString().substring(0, 8));
        assertThat(loyalty.previewEarnRecalc(unpaid).getReason()).isEqualTo("NOT_PAID");
        long noCustomer = id("insert into don_hang(ngay_dat, trang_thai, tong_tien, ma_don) values (now(), 'COMPLETED', 1, ?) returning ma_don_hang",
                "S3-" + UUID.randomUUID().toString().substring(0, 8));
        assertThat(loyalty.previewEarnRecalc(noCustomer).getReason()).isEqualTo("NO_CUSTOMER");
        assertThat(loyalty.recalculateEarn(unpaid).isApplied()).isFalse();
        assertThat(rows(c, "EARN")).isZero();
        as("CUSTOMER");
        assertThatThrownBy(() -> loyalty.recalculateEarn(unpaid)).isInstanceOf(AppException.class);
    }

    @Test
    void adjustChangesBalanceRefusesBadInputAndReplaysSameRequest() {
        as("ADMIN");
        long c = customer(120);
        PointsAdjustmentRequest minus = adjust(-30, "BOI_THUONG", "ghi chu noi bo");
        PointsAdjustmentResponse done = loyalty.adjustPoints(c, minus);
        assertThat(done.getBalanceBefore()).isEqualTo(120);
        assertThat(done.getBalanceAfter()).isEqualTo(90);
        assertThat(balance(c)).isEqualTo(90);
        assertThat(jdbc.queryForObject("select points || '/' || ly_do || '/' || ghi_chu || '/' || nguoi_thuc_hien from loyalty_ledger_entry "
                + "where customer_id=? and entry_type='ADJUST'", String.class, c)).isEqualTo("-30/BOI_THUONG/ghi chu noi bo/test_admin");

        PointsAdjustmentResponse replay = loyalty.adjustPoints(c, minus);
        assertThat(replay.isReplayed()).isTrue();
        assertThat(replay.getBalanceBefore()).isNull();
        assertThat(replay.getBalanceAfter()).isNull();
        assertThat(balance(c)).isEqualTo(90);
        assertThat(rows(c, "ADJUST")).isEqualTo(1);

        refused(() -> loyalty.adjustPoints(c, adjust(-91, "KHAC", "x")), "BELOW_ZERO");
        refused(() -> loyalty.adjustPoints(c, adjust(0, "KHAC", "x")), "NON_ZERO");
        refused(() -> loyalty.adjustPoints(c, adjust(5, "KHAC", "  ")), "REQUIRED_FOR_OTHER");
        refused(() -> loyalty.adjustPoints(c, adjust(5, "NOPE", null)), "INVALID_REASON");
        refused(() -> loyalty.adjustPoints(c, adjust(Integer.MAX_VALUE, "TANG_THEM", null)), "OVER_MAX");
        jdbc.update("update khach_hang set diem_giu_cho=50 where ma_kh=?", c);
        refused(() -> loyalty.adjustPoints(c, adjust(-50, "TANG_THEM", null)), "BELOW_HELD");
        loyalty.adjustPoints(c, adjust(-40, "DIEU_CHINH_SAI_SOT", null));
        assertThat(balance(c)).isEqualTo(50);
        assertThat(rows(c, "ADJUST")).isEqualTo(2);

        // reusing a requestId with a different delta is a conflict, never a second write
        PointsAdjustmentRequest clash = adjust(7, "TANG_THEM", null);
        clash.setRequestId(minus.getRequestId());
        assertThatThrownBy(() -> loyalty.adjustPoints(c, clash)).isInstanceOf(AppException.class);

        as("STAFF");
        assertThatThrownBy(() -> loyalty.adjustPoints(c, adjust(5, "TANG_THEM", null))).isInstanceOf(AppException.class);
        assertThat(balance(c)).isEqualTo(50);
    }

    @Test
    void ledgerStaysAppendOnlyAndCheckConstraintsHold() {
        as("ADMIN");
        long c = customer(10);
        PointsAdjustmentResponse r = loyalty.adjustPoints(c, adjust(5, "TANG_THEM", null));
        assertThatThrownBy(() -> jdbc.update("update loyalty_ledger_entry set points=1 where entry_id=?", r.getEntryId()))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("delete from loyalty_ledger_entry where entry_id=?", r.getEntryId()))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("insert into loyalty_ledger_entry(customer_id, entry_type, points, source_key) values (?, 'EARN', -3, 'x1')", c))
                .hasMessageContaining("ck_loyalty_entry_points");
        assertThatThrownBy(() -> jdbc.update("insert into loyalty_ledger_entry(customer_id, entry_type, points, source_key) values (?, 'ADJUST', 3, 'x2')", c))
                .hasMessageContaining("ck_loyalty_adjust_meta");
    }

    @Test
    void legacyBalanceWithoutOpeningStaysConsistentAfterAdjust() {
        as("ADMIN");
        long c = customer(100);
        loyalty.adjustPoints(c, adjust(10, "TANG_THEM", null));
        assertThat(balance(c)).isEqualTo(110);
        var open = new LegacyOpeningRequest();
        open.setCustomerId(c);
        loyalty.openLegacyBalance(open);
        // the OPENING baseline is balance minus what the ledger already holds, so the ledger sums to the balance
        assertThat(jdbc.queryForObject("select points from loyalty_ledger_entry where customer_id=? and entry_type='OPENING'", Integer.class, c)).isEqualTo(100);
        assertThat(ledgerSum(c)).isEqualTo(110);

        loyalty.adjustPoints(c, adjust(-20, "HOAN_DON", null));
        assertThat(ledgerSum(c)).isEqualTo(balance(c)).isEqualTo(90);

        List<AdminLedgerItemResponse> history = loyalty.customerHistory(c, 0, 20).getContent();
        assertThat(history).hasSize(3);
        assertThat(history.get(0).getType().name()).isEqualTo("ADJUST");
        assertThat(history.get(0).getDelta()).isEqualTo(-20);
        assertThat(history.get(0).getBalanceAfter()).isEqualTo(90);
        assertThat(history.get(1).getType().name()).isEqualTo("OPENING");
        assertThat(history.get(1).getBalanceAfter()).isEqualTo(110);
        assertThat(history.get(2).getDelta()).isEqualTo(10);
        assertThat(history.get(2).getBalanceAfter()).isEqualTo(110);
        // second page keeps the running balance exact
        var page2 = loyalty.customerHistory(c, 1, 2).getContent();
        assertThat(page2).hasSize(1);
        assertThat(page2.get(0).getBalanceAfter()).isEqualTo(110);
    }

    @Test
    void legacyOrderWithoutOpeningIsRefusedAsUntracked() {
        policy("25000");
        long c = customer(100);
        long o = paidOrder(c, "COMPLETED", "500000.00", null);
        assertThat(loyalty.previewEarnRecalc(o).getReason()).isEqualTo("LEGACY_UNTRACKED");
        assertThat(loyalty.previewEarnRecalc(o).isEligible()).isFalse();
        assertThat(loyalty.recalculateEarn(o).isApplied()).isFalse();
        assertThat(balance(c)).isEqualTo(100);
        assertThat(rows(c, "EARN")).isZero();
    }

    @Test
    void legacySettleRecordsEarnedPointsSoRecalcCannotDoubleCredit() {
        policy("25000");
        long c = customer(0);
        long o = paidOrder(c, "COMPLETED", "500000.00", null);
        legacySettle(o, "500000.00");
        assertThat(balance(c)).isEqualTo(5);                    // legacy rate: 1 point per 100000
        assertThat(rows(c, "EARN")).isZero();                   // no OPENING, so no ledger row
        assertThat(jdbc.queryForObject("select earned_points from don_hang where ma_don_hang=?", Integer.class, o)).isEqualTo(5);
        // even after the OPENING baseline appears, the recorded earned_points blocks a second credit
        openingOf(c);
        assertThat(loyalty.previewEarnRecalc(o).getReason()).isEqualTo("ALREADY_EARNED");
        assertThat(loyalty.recalculateEarn(o).isApplied()).isFalse();
        assertThat(balance(c)).isEqualTo(5);
    }

    @Test
    void recalcFollowsThePathThatRan() {
        policy("25000");
        long c = customer(10);
        openingOf(c);
        // fingerprinted order priced while no points policy was enabled: the normal path did not pay it
        long noPolicy = paidOrder(c, "COMPLETED", "500000.00", new long[] { 1, 1 });
        jdbc.update("update don_hang set loyalty_policy_id = null, loyalty_policy_version = null, redeem_currency_per_point_snapshot = null where ma_don_hang = ?", noPolicy);
        EarnRecalcResponse a = loyalty.previewEarnRecalc(noPolicy);
        assertThat(a.isEligible()).isFalse();
        assertThat(a.getReason()).isEqualTo("NO_POLICY_AT_CHECKOUT");
        // legacy voucher order: settleLegacyEarn returns without award
        long voucher = paidOrder(c, "COMPLETED", "500000.00", null);
        jdbc.update("update don_hang set ma_code_voucher = 'VC-OLD' where ma_don_hang = ?", voucher);
        legacySettle(voucher, "500000.00");
        assertThat(balance(c)).isEqualTo(10);
        EarnRecalcResponse b = loyalty.previewEarnRecalc(voucher);
        assertThat(b.isEligible()).isFalse();
        assertThat(b.getReason()).isEqualTo("VOUCHER_NO_EARN");
        assertThat(loyalty.recalculateEarn(voucher).isApplied()).isFalse();
        assertThat(rows(c, "EARN")).isZero();
        // a legacy order without voucher whose customer has OPENING and no earn row still falls back to the current policy
        long plain = paidOrder(c, "COMPLETED", "500000.00", null);
        assertThat(loyalty.previewEarnRecalc(plain).isEligible()).isTrue();
    }

    @Test
    void historyHidesBalanceAfterWhenLedgerCannotReproduceBalance() {
        as("ADMIN");
        long c = customer(100);
        loyalty.adjustPoints(c, adjust(10, "TANG_THEM", null));   // ledger sum 10, balance 110, no OPENING
        var rows = loyalty.customerHistory(c, 0, 20).getContent();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getBalanceAfter()).isNull();
        assertThat(rows.get(0).getDelta()).isEqualTo(10);
        // consistent customer (no legacy gap) keeps the column
        long d = customer(0);
        loyalty.adjustPoints(d, adjust(7, "TANG_THEM", null));
        assertThat(loyalty.customerHistory(d, 0, 20).getContent().get(0).getBalanceAfter()).isEqualTo(7);
    }
}
