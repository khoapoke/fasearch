package com.springboot.fasearch.modules.loyalty.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.exception.FieldErrorDetail;
import com.springboot.fasearch.modules.loyalty.dto.response.LedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.PointsAdjustmentRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.AdminLedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.EarnRecalcResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.PointsAdjustmentResponse;
import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import java.util.Set;
import java.util.stream.Collectors;
import com.springboot.fasearch.modules.loyalty.dto.request.LegacyOpeningRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.LegacyOpeningResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.CustomerLoyaltyPolicyRes;
import com.springboot.fasearch.modules.loyalty.dto.response.LoyaltyBalanceResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyCreateRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.LoyaltyPolicyResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyUpdateRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.SalesTierResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.SalesTierUpdateRequest;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyLedgerEntry;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyHoldStatus;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyOrderHold;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyPolicy;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyPolicyVersion;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyPolicyStatus;
import com.springboot.fasearch.modules.loyalty.repository.LoyaltyLedgerRepository;
import com.springboot.fasearch.modules.loyalty.repository.LoyaltyOrderHoldRepository;
import com.springboot.fasearch.modules.loyalty.repository.LoyaltyPolicyRepository;
import com.springboot.fasearch.modules.loyalty.repository.LoyaltyPolicyVersionRepository;
import com.springboot.fasearch.modules.loyalty.service.LoyaltyMath;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService.QuoteSnapshot;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.MembershipTier;
import com.springboot.fasearch.modules.user.repository.MembershipTierRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.SecurityUtils;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LoyaltyServiceImpl implements LoyaltyService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final BigDecimal ZERO_MONEY = new BigDecimal("0.00");
    private static final BigDecimal LEGACY_EARN_CURRENCY_PER_POINT = BigDecimal.valueOf(100000);
    private static final BigDecimal MAX_POINTS = BigDecimal.valueOf(Integer.MAX_VALUE);
    private static final Set<String> ADJUST_REASONS = Set.of(
            "BOI_THUONG", "DIEU_CHINH_SAI_SOT", "TANG_THEM", "HOAN_DON", "KHAC");
    static final String REASON_RECALC = "TINH_LAI_DON";

    private final UserRepository customerRepository;
    private final MembershipTierRepository tierRepository;
    private final LoyaltyPolicyRepository policyRepository;
    private final LoyaltyPolicyVersionRepository policyVersionRepository;
    private final LoyaltyLedgerRepository ledgerRepository;
    private final LoyaltyOrderHoldRepository holdRepository;
    private final InvoiceRepository invoiceRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public LoyaltyBalanceResponse myBalance() {
        String username = SecurityUtils.getCurrentUsername().orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        Customer customer = customerRepository.findByAccount_Username(username)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        return balance(customer);
    }

    @Transactional(readOnly = true)
    public LoyaltyBalanceResponse customerBalance(Long customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        return balance(customer);
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerLoyaltyPolicyRes myPolicy() {
        String username = SecurityUtils.getCurrentUsername().orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        Customer customer = customerRepository.findByAccount_Username(username)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        LoyaltyPolicySnapshot policy = currentPolicy();
        return CustomerLoyaltyPolicyRes.builder()
                .balance(balance(customer))
                .policy(LoyaltyPolicyResponse.builder().policyId(policy.id()).version(policy.version())
                        .earnCurrencyPerPoint(policy.earnRate()).redeemCurrencyPerPoint(policy.redeemRate())
                        .status(policy.status()).build())
                .tiers(salesTiers())
                .build();
    }

    @Transactional(readOnly = true)
    public PageResponse<LedgerItemResponse> myHistory(int page, int size) {
        String username = SecurityUtils.getCurrentUsername().orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        Customer customer = customerRepository.findByAccount_Username(username)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        return PageResponse.from(ledgerRepository.findByCustomer_IdOrderByOccurredAtDescIdDesc(customer.getId(), pageable)
                .map(this::ledgerResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<LoyaltyPolicyResponse> policies(int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<LoyaltyPolicyVersion> versions = policyVersionRepository.findAllByOrderByPolicyIdDescVersionDesc(pageable);
        List<Long> ids = versions.getContent().stream().map(LoyaltyPolicyVersion::getPolicyId).distinct().toList();
        Map<Long, LoyaltyPolicy> policies = new HashMap<>();
        policyRepository.findAllById(ids).forEach(policy -> policies.put(policy.getId(), policy));
        return PageResponse.from(versions.map(version -> policyResponse(version, policies.get(version.getPolicyId()))));
    }

    @Transactional
    public LoyaltyPolicyResponse createPolicy(LoyaltyPolicyCreateRequest request) {
        BigDecimal earn = validateRate(request.getEarnCurrencyPerPoint(), "earnCurrencyPerPoint");
        BigDecimal redeem = validateRate(request.getRedeemCurrencyPerPoint(), "redeemCurrencyPerPoint");
        LoyaltyPolicyStatus status = normalizeStatus(request.getStatus() == null ? "DISABLED" : request.getStatus());
        if (status == LoyaltyPolicyStatus.ENABLED) disableActivePolicy(null);

        LoyaltyPolicy policy = new LoyaltyPolicy();
        policy.setCurrentVersion(1L);
        policy.setStatus(status);
        policy = policyRepository.save(policy);
        LoyaltyPolicyVersion version = policyVersionRepository.save(LoyaltyPolicyVersion.builder()
                .policyId(policy.getId()).version(1L).earnCurrencyPerPoint(earn)
                .redeemCurrencyPerPoint(redeem).build());
        return policyResponse(version, policy);
    }

    @Transactional
    public LoyaltyPolicyResponse updatePolicy(Long policyId, LoyaltyPolicyUpdateRequest request) {
        LoyaltyPolicy policy = policyRepository.findByIdForUpdate(policyId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy chính sách điểm."));
        if (!Objects.equals(policy.getCurrentVersion(), request.getVersion())) {
            throw new AppException(ErrorCode.LOYALTY_POLICY_VERSION_CHANGED);
        }
        BigDecimal earn = validateRate(request.getEarnCurrencyPerPoint(), "earnCurrencyPerPoint");
        BigDecimal redeem = validateRate(request.getRedeemCurrencyPerPoint(), "redeemCurrencyPerPoint");
        LoyaltyPolicyStatus status = normalizeStatus(request.getStatus());
        if (status == LoyaltyPolicyStatus.ENABLED) disableActivePolicy(policyId);
        policy.setCurrentVersion(policy.getCurrentVersion() + 1);
        policy.setStatus(status);
        policyRepository.save(policy);
        LoyaltyPolicyVersion version = policyVersionRepository.save(LoyaltyPolicyVersion.builder()
                .policyId(policyId).version(policy.getCurrentVersion()).earnCurrencyPerPoint(earn)
                .redeemCurrencyPerPoint(redeem).build());
        return policyResponse(version, policy);
    }

    @Transactional
    public LegacyOpeningResponse openLegacyBalance(LegacyOpeningRequest request) {
        Customer customer = customerRepository.findByIdForUpdate(request.getCustomerId())
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        if (ledgerRepository.existsByCustomer_IdAndType(customer.getId(), LoyaltyEntryType.OPENING)) {
            throw new AppException(ErrorCode.OPENING_ALREADY_RECORDED);
        }
        LoyaltyLedgerEntry entry = writeOpening(customer);
        int points = entry.getPoints();
        return LegacyOpeningResponse.builder().customerId(customer.getId()).openingRecorded(true)
                .openingPoints(points).entryId(entry.getId()).occurredAt(entry.getOccurredAt()).build();
    }

    /**
     * Writes the one-time OPENING baseline for a locked customer. The ledger must sum to the current
     * balance afterwards, and EARN/REDEEM rows can already exist without an opening (settleOrder
     * appends them regardless), so the baseline is the balance minus what the ledger already holds.
     */
    private LoyaltyLedgerEntry writeOpening(Customer customer) {
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        long points = balance - ledgerRepository.sumBalanceEffect(customer.getId());
        if (balance < 0 || points < 0 || points > Integer.MAX_VALUE) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Số dư điểm cũ không hợp lệ.");
        }
        return ledgerRepository.save(LoyaltyLedgerEntry.builder()
                .customer(customer).type(LoyaltyEntryType.OPENING).points((int) points)
                .sourceKey("opening:" + customer.getId()).occurredAt(LocalDateTime.now()).build());
    }

    @Transactional(readOnly = true)
    public List<SalesTierResponse> salesTiers() {
        return tierRepository.findAll(Sort.by(Sort.Order.asc("minimumCumulativePaidSales"), Sort.Order.asc("id")))
                .stream().map(this::tierResponse).toList();
    }

    @Transactional
    public SalesTierResponse updateSalesTier(Long tierId, SalesTierUpdateRequest request) {
        List<MembershipTier> tiers = tierRepository.findAllForUpdate();
        MembershipTier tier = tiers.stream().filter(row -> row.getId().equals(tierId)).findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy hạng thành viên."));
        if (!Objects.equals(tier.getSalesTierVersion(), request.getVersion())) {
            throw new AppException(ErrorCode.LOYALTY_TIER_VERSION_CHANGED);
        }
        BigDecimal threshold = money(request.getMinimumCumulativePaidSales(), "minimumCumulativePaidSales");
        tier.setMinimumCumulativePaidSales(threshold);
        tier.setSalesTierVersion(tier.getSalesTierVersion() + 1);
        List<MembershipTier> configured = tiers.stream().filter(row -> row.getMinimumCumulativePaidSales() != null)
                .sorted(Comparator.comparing(MembershipTier::getId)).toList();
        BigDecimal previous = null;
        for (MembershipTier row : configured) {
            BigDecimal current = row.getId().equals(tierId) ? threshold : row.getMinimumCumulativePaidSales();
            if (previous != null && previous.compareTo(current) >= 0) {
                throw fieldError("minimumCumulativePaidSales", "configured thresholds must increase by tierId");
            }
            previous = current;
        }
        tierRepository.save(tier);
        return tierResponse(tier);
    }

    @Transactional(readOnly = true)
    public QuoteSnapshot quote(Long customerId, int requestedPoints, BigDecimal remainingMerchandise,
            List<LoyaltyMath.Line> lines) {
        return quote(customerId, requestedPoints, remainingMerchandise, lines, false);
    }

    @Transactional
    public QuoteSnapshot quoteForCommit(Long customerId, int requestedPoints, BigDecimal remainingMerchandise,
            List<LoyaltyMath.Line> lines) {
        return quote(customerId, requestedPoints, remainingMerchandise, lines, true);
    }

    private QuoteSnapshot quote(Long customerId, int requestedPoints, BigDecimal remainingMerchandise,
            List<LoyaltyMath.Line> lines, boolean lock) {
        if (requestedPoints < 0) throw fieldError("redeemedPoints", "must be a non-negative whole number");
        Customer customer = customerId == null ? null : (lock
                ? customerRepository.findByIdForUpdate(customerId) : customerRepository.findById(customerId))
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        if (customer == null) {
            if (requestedPoints > 0) throw fieldError("redeemedPoints", "customerless orders cannot redeem points");
            LoyaltyPolicySnapshot policy = currentPolicy(lock);
            return new QuoteSnapshot(0, ZERO_MONEY, LoyaltyMath.allocate(lines, ZERO_MONEY), 0,
                    null, policy.status(), policy.id(), policy.version(), policy.redeemRate(), policy.earnRate(), null);
        }
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        int held = customer.getHeldPoints() == null ? 0 : customer.getHeldPoints();
        if (balance < 0 || held < 0 || held > balance) throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        // Legacy points are usable without a manual opening: the preview shows balance - held with no
        // ledger write, and the locked commit path writes the opening itself when points are redeemed.
        int available = balance - held;
        LoyaltyPolicySnapshot policy = currentPolicy(lock);
        int allowed = LoyaltyMath.allowed(available, true,
                LoyaltyPolicyStatus.ENABLED.name().equals(policy.status()),
                remainingMerchandise, policy.redeemRate());
        if (requestedPoints > 0) {
            if (policy.id() == null) throw new AppException(ErrorCode.LOYALTY_POLICY_UNAVAILABLE);
            if (!LoyaltyPolicyStatus.ENABLED.name().equals(policy.status())) {
                throw new AppException(ErrorCode.LOYALTY_POLICY_DISABLED);
            }
            if (requestedPoints > allowed) {
                throw new AppException(ErrorCode.INSUFFICIENT_POINTS,
                        "Số điểm yêu cầu vượt quá mức cho phép hiện tại.",
                        List.of(new FieldErrorDetail("redeemedPoints", "Allowed maximum: " + allowed)));
            }
            if (lock && !ledgerRepository.existsByCustomer_IdAndType(customerId, LoyaltyEntryType.OPENING)) {
                writeOpening(customer);
            }
        }
        BigDecimal discount = requestedPoints == 0 ? ZERO_MONEY : LoyaltyMath.discount(requestedPoints, policy.redeemRate());
        Map<Long, BigDecimal> allocation = LoyaltyMath.allocate(lines, discount);
        return new QuoteSnapshot(requestedPoints, discount, allocation, allowed,
                available, policy.status(), policy.id(), policy.version(),
                policy.redeemRate(), policy.earnRate(), customerId);
    }

    @Transactional
    public void holdOrder(Long orderId, QuoteSnapshot quote) {
        if (quote.redeemedPoints() == 0) return;
        if (quote.customerId() == null) throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        LoyaltyOrderHold existing = holdRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (existing != null) {
            if (existing.getStatus() == LoyaltyHoldStatus.HELD && existing.getPoints() == quote.redeemedPoints()) return;
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        }
        Customer customer = customerRepository.findByIdForUpdate(quote.customerId())
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        int held = customer.getHeldPoints() == null ? 0 : customer.getHeldPoints();
        int nextHeld;
        try { nextHeld = Math.addExact(held, quote.redeemedPoints()); }
        catch (ArithmeticException ex) { throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT); }
        if (balance < nextHeld) throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        customer.setHeldPoints(nextHeld);
        holdRepository.save(LoyaltyOrderHold.builder().orderId(orderId).customer(customer)
                .points(quote.redeemedPoints()).status(LoyaltyHoldStatus.HELD).build());
        appendLedger(customer, LoyaltyEntryType.HOLD, quote.redeemedPoints(), orderId, "hold:" + orderId);
    }

    @Transactional
    public void releaseOrderHold(Long orderId) {
        LoyaltyOrderHold hold = holdRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (hold == null || hold.getStatus() != LoyaltyHoldStatus.HELD) return;
        Customer customer = customerRepository.findByIdForUpdate(hold.getCustomer().getId())
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        int held = customer.getHeldPoints() == null ? 0 : customer.getHeldPoints();
        if (held < hold.getPoints()) throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        customer.setHeldPoints(held - hold.getPoints());
        hold.setStatus(LoyaltyHoldStatus.RELEASED);
        appendLedger(customer, LoyaltyEntryType.RELEASE, hold.getPoints(), orderId, "release:" + orderId);
    }

    @Transactional
    public void settleOrder(Order order, BigDecimal actualPaid) {
        if (order.getEarnedPoints() != null) return;
        if (order.getCustomer() == null && (positive(order.getRedeemedPoints()) || order.getLoyaltyPolicyId() != null)) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        }
        LoyaltyOrderHold hold = holdRepository.findByOrderIdForUpdate(order.getId()).orElse(null);
        if (positive(order.getRedeemedPoints()) && (hold == null || hold.getStatus() != LoyaltyHoldStatus.HELD)) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        }
        if (hold != null && hold.getStatus() == LoyaltyHoldStatus.RELEASED) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        }
        if (hold != null && hold.getStatus() == LoyaltyHoldStatus.CONSUMED) return;
        if (order.getCustomer() == null) {
            order.setEarnedPoints(null);
            return;
        }
        Customer customer = customerRepository.findByIdForUpdate(order.getCustomer().getId())
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        int held = customer.getHeldPoints() == null ? 0 : customer.getHeldPoints();
        if (hold != null) {
            if (held < hold.getPoints() || balance < hold.getPoints()) throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
            customer.setHeldPoints(held - hold.getPoints());
            customer.setAccumulatePoint(balance - hold.getPoints());
            hold.setStatus(LoyaltyHoldStatus.CONSUMED);
            appendLedger(customer, LoyaltyEntryType.REDEEM, hold.getPoints(), order.getId(), "redeem:" + order.getId());
            balance -= hold.getPoints();
        }
        if (order.getLoyaltyPolicyId() == null) {
            order.setEarnedPoints(null);
            return;
        }
        LoyaltyPolicyVersion policy = policyVersionRepository.findByPolicyIdAndVersion(
                order.getLoyaltyPolicyId(), order.getLoyaltyPolicyVersion())
                .orElseThrow(() -> new AppException(ErrorCode.LOYALTY_STATE_CONFLICT));
        int earned = computeEarn(policy, actualPaid);
        creditEarn(customer, order, balance, earned, null);
    }

    /** The one earn formula: floor(paid / earnCurrencyPerPoint) under the given policy version. */
    private static int computeEarn(LoyaltyPolicyVersion policy, BigDecimal actualPaid) {
        try {
            return LoyaltyMath.earnedPoints(actualPaid == null ? ZERO_MONEY : actualPaid,
                    policy.getEarnCurrencyPerPoint());
        } catch (ArithmeticException ex) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Số điểm tích lũy vượt quá mức số dư được hỗ trợ.");
        }
    }

    /**
     * The one earn write: caller holds the customer row lock. Adds to the balance, appends the
     * order-keyed EARN entry (idempotent on earn:{orderId}) and records the order's earned points.
     * {@code recalcActor} is non-null only for an admin recalculation, which is then marked in the ledger.
     */
    private void creditEarn(Customer customer, Order order, int balanceBeforeEarn, int earned, String recalcActor) {
        int balance;
        try { balance = Math.addExact(balanceBeforeEarn, earned); }
        catch (ArithmeticException ex) { throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT); }
        if (earned > 0) {
            customer.setAccumulatePoint(balance);
            appendLedger(customer, LoyaltyEntryType.EARN, earned, order.getId(), "earn:" + order.getId(),
                    recalcActor == null ? null : REASON_RECALC, null, recalcActor);
        }
        order.setEarnedPoints(earned);
    }

    /**
     * Pre-S2 fixed-rate award for orders without a loyalty quote snapshot. Keeps the legacy rate but
     * settles atomically: customer row lock, overflow-checked add, and one order-keyed EARN entry
     * whenever the opening baseline exists.
     */
    @Transactional
    public void settleLegacyEarn(Order order, BigDecimal actualPaid) {
        if (order.getCustomer() == null || order.getVoucherCode() != null) return;
        Customer customer = customerRepository.findByIdForUpdate(order.getCustomer().getId())
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        String sourceKey = "earn:" + order.getId();
        boolean opening = ledgerRepository.existsByCustomer_IdAndType(customer.getId(), LoyaltyEntryType.OPENING);
        if (opening && ledgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), sourceKey).isPresent()) return;
        BigDecimal award = (actualPaid == null ? ZERO_MONEY : actualPaid)
                .divide(LEGACY_EARN_CURRENCY_PER_POINT, 0, RoundingMode.FLOOR);
        if (award.signum() <= 0) return;
        if (award.compareTo(MAX_POINTS) > 0) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Số điểm cộng từ dữ liệu cũ vượt quá mức số dư được hỗ trợ.");
        }
        int pointsEarned = award.intValue();
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        try {
            customer.setAccumulatePoint(Math.addExact(balance, pointsEarned));
        } catch (ArithmeticException ex) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Số dư điểm cũ vượt quá mức được hỗ trợ.");
        }
        if (opening) appendLedger(customer, LoyaltyEntryType.EARN, pointsEarned, order.getId(), sourceKey);
        // Recorded even without a ledger row, so a later recalculation can tell this order was already paid.
        order.setEarnedPoints(pointsEarned);
    }

    // ---- Admin: history, manual adjustment, per-order EARN recalculation ----

    @Transactional(readOnly = true)
    public PageResponse<AdminLedgerItemResponse> customerHistory(Long customerId, int page, int size) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<LoyaltyLedgerEntry> entries = ledgerRepository
                .findByCustomer_IdOrderByOccurredAtDescIdDesc(customerId, pageable);
        List<Long> orderIds = entries.getContent().stream().map(LoyaltyLedgerEntry::getOrderId)
                .filter(Objects::nonNull).distinct().toList();
        Map<Long, String> orderCodes = orderIds.isEmpty() ? Map.of()
                : orderRepository.findAllById(orderIds).stream()
                        .collect(Collectors.toMap(Order::getId, o -> o.getOrderCode() == null ? "" : o.getOrderCode()));
        // balance after a row = current balance - effect of every newer row (exact even without an OPENING row)
        long newer = ledgerRepository.sumNewestEffect(customerId, (int) pageable.getOffset());
        long balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        // Without an OPENING baseline, legacy credits may have changed the balance with no ledger row;
        // then the ledger cannot reproduce the balance and a per-row "balance after" would be wrong.
        boolean balanceTraceable = ledgerRepository.existsByCustomer_IdAndType(customerId, LoyaltyEntryType.OPENING)
                || ledgerRepository.sumBalanceEffect(customerId) == balance;
        List<AdminLedgerItemResponse> rows = new ArrayList<>();
        for (LoyaltyLedgerEntry entry : entries.getContent()) {
            int delta = balanceEffect(entry);
            rows.add(AdminLedgerItemResponse.builder().entryId(entry.getId()).type(entry.getType())
                    .points(entry.getPoints()).delta(delta).balanceAfter(balanceTraceable ? (Integer) (int) (balance - newer) : null)
                    .orderId(entry.getOrderId()).orderCode(entry.getOrderId() == null ? null : orderCodes.get(entry.getOrderId()))
                    .reasonCode(entry.getReasonCode()).note(entry.getNote()).actor(entry.getActor())
                    .occurredAt(entry.getOccurredAt()).build());
            newer += delta;
        }
        return PageResponse.from(new org.springframework.data.domain.PageImpl<>(rows, pageable, entries.getTotalElements()));
    }

    private static int balanceEffect(LoyaltyLedgerEntry entry) {
        return switch (entry.getType()) {
            case EARN, ADJUST, RETURN_REDEEM -> entry.getPoints();
            case REDEEM, RETURN_REVERSE -> -entry.getPoints();
            default -> 0;
        };
    }

    /** Single check point for manual adjustments: permission LOYALTY_ADJUST (ADMIN always has it). */
    private static void requireAdjustPermission() {
        if (!SecurityUtils.hasPermission(com.springboot.fasearch.security.Permission.LOYALTY_ADJUST)) {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }
    }

    /** Single check point for per-order EARN recalculation: permission LOYALTY_ADJUST (ADMIN always has it). */
    private static void requireRecalcPermission() {
        if (!SecurityUtils.hasPermission(com.springboot.fasearch.security.Permission.LOYALTY_ADJUST)) {
            throw new AppException(ErrorCode.ACCESS_DENIED);
        }
    }

    private static String currentActor() {
        return SecurityUtils.getCurrentUsername().orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
    }

    @Transactional
    public PointsAdjustmentResponse adjustPoints(Long customerId, PointsAdjustmentRequest request) {
        requireAdjustPermission();
        String actor = currentActor();
        Integer delta = request.getDelta();
        if (delta == null || delta == 0) throw fieldError("delta", "NON_ZERO");
        String reason = request.getReasonCode() == null ? "" : request.getReasonCode().strip();
        if (!ADJUST_REASONS.contains(reason)) throw fieldError("reasonCode", "INVALID_REASON");
        String note = request.getNote() == null || request.getNote().isBlank() ? null : request.getNote().strip();
        if ("KHAC".equals(reason) && note == null) throw fieldError("note", "REQUIRED_FOR_OTHER");
        if (note != null && note.length() > 500) throw fieldError("note", "TOO_LONG");
        String sourceKey = "adjust:" + request.getRequestId();

        Customer customer = customerRepository.findByIdForUpdate(customerId)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        int held = customer.getHeldPoints() == null ? 0 : customer.getHeldPoints();
        LoyaltyLedgerEntry existing = ledgerRepository.findByCustomer_IdAndSourceKey(customerId, sourceKey).orElse(null);
        if (existing != null) {
            if (existing.getType() != LoyaltyEntryType.ADJUST || !existing.getPoints().equals(delta)) {
                throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
            }
            // The balances of the first request are not stored; balance - delta would be wrong after any later change.
            return PointsAdjustmentResponse.builder().entryId(existing.getId()).customerId(customerId).delta(delta)
                    .balanceBefore(null).balanceAfter(null).reasonCode(existing.getReasonCode())
                    .occurredAt(existing.getOccurredAt()).replayed(true).build();
        }
        long next = (long) balance + delta;
        if (next < 0) throw fieldError("delta", "BELOW_ZERO");
        if (next < held) throw fieldError("delta", "BELOW_HELD");
        if (next > Integer.MAX_VALUE) throw fieldError("delta", "OVER_MAX");
        customer.setAccumulatePoint((int) next);
        LoyaltyLedgerEntry entry = appendLedger(customer, LoyaltyEntryType.ADJUST, delta, null, sourceKey,
                reason, note, actor);
        return PointsAdjustmentResponse.builder().entryId(entry.getId()).customerId(customerId).delta(delta)
                .balanceBefore(balance).balanceAfter((int) next).reasonCode(reason)
                .occurredAt(entry.getOccurredAt()).replayed(false).build();
    }

    @Transactional(readOnly = true)
    public EarnRecalcResponse previewEarnRecalc(Long orderId) {
        requireRecalcPermission();
        Order order = orderRepository.findById(orderId).orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        return planRecalc(order).view();
    }

    /**
     * Writes the missing EARN entry for a paid order through the same earn code path as normal settlement
     * (creditEarn) under the same key earn:{orderId}. Order and customer rows are locked and eligibility is
     * re-checked under the lock, so a second call or a concurrent normal settlement cannot credit twice:
     * the ledger row (and earned_points, which makes settleOrder return early) exists after the first write.
     */
    @Transactional
    public EarnRecalcResponse recalculateEarn(Long orderId) {
        requireRecalcPermission();
        String actor = currentActor();
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (order.getCustomer() != null) {
            customerRepository.findByIdForUpdate(order.getCustomer().getId())
                    .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        }
        RecalcPlan plan = planRecalc(order);
        if (!plan.view().isEligible()) return plan.view();
        Customer customer = order.getCustomer();
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        creditEarn(customer, order, balance, plan.earned(), actor);
        return withApplied(plan.view(), balance, customer.getAccumulatePoint());
    }

    private record RecalcPlan(EarnRecalcResponse view, int earned) {}

    private RecalcPlan planRecalc(Order order) {
        Customer customer = order.getCustomer();
        int balance = customer == null || customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        EarnRecalcResponse.EarnRecalcResponseBuilder view = EarnRecalcResponse.builder().orderId(order.getId())
                .orderCode(order.getOrderCode()).customerId(customer == null ? null : customer.getId())
                .balanceBefore(customer == null ? null : balance);
        if (customer == null) return refuse(view, "NO_CUSTOMER");
        OrderStatus status = order.getStatus();
        if (status != OrderStatus.CONFIRMED && status != OrderStatus.PACKING
                && status != OrderStatus.SHIPPING && status != OrderStatus.COMPLETED) {
            return refuse(view, "STATUS");
        }
        Invoice invoice = invoiceRepository.findByOrderId(order.getId()).orElse(null);
        if (invoice == null || invoice.getStatus() != PaymentStatus.PAID || Boolean.TRUE.equals(invoice.getIsDeleted())) {
            return refuse(view, "NOT_PAID");
        }
        BigDecimal paid = invoice.getTotalActualPaid() == null ? ZERO_MONEY
                : invoice.getTotalActualPaid().setScale(2, RoundingMode.HALF_UP);
        view.paidAmount(paid);
        if (ledgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), "earn:" + order.getId()).isPresent()) {
            return refuse(view, "ALREADY_EARNED");
        }
        if (order.getEarnedPoints() != null) return refuse(view, "ALREADY_EARNED");
        // Replicate the path that ran at payment time: fingerprinted orders follow their own snapshot,
        // legacy (no fingerprint) orders followed settleLegacyEarn.
        boolean legacy = order.getLoyaltyQuoteFingerprint() == null || order.getLoyaltyQuoteFingerprint().isBlank();
        if (legacy) {
            if (order.getVoucherCode() != null) return refuse(view, "VOUCHER_NO_EARN");
            if (!ledgerRepository.existsByCustomer_IdAndType(customer.getId(), LoyaltyEntryType.OPENING)) {
                return refuse(view, "LEGACY_UNTRACKED");
            }
        } else if (order.getLoyaltyPolicyId() == null) {
            return refuse(view, "NO_POLICY_AT_CHECKOUT");
        }
        if (positive(order.getRedeemedPoints())) {
            LoyaltyOrderHold hold = holdRepository.findById(order.getId()).orElse(null);
            if (hold == null || hold.getStatus() != LoyaltyHoldStatus.CONSUMED) return refuse(view, "STATE_CONFLICT");
        }
        // Rate: the order's own policy version when it has one (exactly what normal settlement uses);
        // an order paid before any policy existed uses the policy in force now (current version of the ENABLED policy).
        LoyaltyPolicyVersion version;
        if (order.getLoyaltyPolicyId() != null) {
            version = policyVersionRepository.findByPolicyIdAndVersion(order.getLoyaltyPolicyId(), order.getLoyaltyPolicyVersion())
                    .orElseThrow(() -> new AppException(ErrorCode.LOYALTY_STATE_CONFLICT));
            view.policySource("ORDER_SNAPSHOT");
        } else {
            LoyaltyPolicy enabled = policyRepository.findFirstByStatusOrderByIdDesc(LoyaltyPolicyStatus.ENABLED).orElse(null);
            version = enabled == null ? null
                    : policyVersionRepository.findByPolicyIdAndVersion(enabled.getId(), enabled.getCurrentVersion()).orElse(null);
            if (version == null) return refuse(view, "NO_POLICY");
            view.policySource("CURRENT_POLICY");
        }
        view.policyId(version.getPolicyId()).policyVersion(version.getVersion())
                .earnCurrencyPerPoint(version.getEarnCurrencyPerPoint());
        int earned = computeEarn(version, paid);
        view.points(earned);
        if (earned <= 0) return refuse(view, "ZERO_POINTS");
        if ((long) balance + earned > Integer.MAX_VALUE) return refuse(view, "STATE_CONFLICT");
        return new RecalcPlan(view.eligible(true).balanceAfter(balance + earned).build(), earned);
    }

    private static RecalcPlan refuse(EarnRecalcResponse.EarnRecalcResponseBuilder view, String reason) {
        return new RecalcPlan(view.eligible(false).reason(reason).build(), 0);
    }

    private static EarnRecalcResponse withApplied(EarnRecalcResponse v, int before, Integer after) {
        return EarnRecalcResponse.builder().orderId(v.getOrderId()).orderCode(v.getOrderCode())
                .customerId(v.getCustomerId()).eligible(false).reason("ALREADY_EARNED").paidAmount(v.getPaidAmount())
                .points(v.getPoints()).policyId(v.getPolicyId()).policyVersion(v.getPolicyVersion())
                .earnCurrencyPerPoint(v.getEarnCurrencyPerPoint()).policySource(v.getPolicySource())
                .balanceBefore(before).balanceAfter(after).applied(true).build();
    }

    @Transactional(readOnly = true)
    public void requireConsumed(Order order) {
        if (!positive(order.getRedeemedPoints())) return;
        LoyaltyOrderHold hold = holdRepository.findById(order.getId()).orElse(null);
        if (hold == null || hold.getStatus() != LoyaltyHoldStatus.CONSUMED) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        }
    }

    public record ReturnSettlement(Customer customer, int balance, int shortfall,
            LoyaltyLedgerEntry reverseEntry, LoyaltyLedgerEntry redeemEntry) {}

    /** Acquire the customer lock and validate every point/ledger calculation before provider I/O. */
    @Transactional
    public ReturnSettlement prepareReturn(Order order, Long returnId, int reverse, int redeemed) {
        if (order.getCustomer() == null) return new ReturnSettlement(null, 0, 0, null, null);
        Customer customer = customerRepository.findByIdForUpdate(order.getCustomer().getId())
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
        String key = "return-reverse:" + returnId;
        if (ledgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), key).isPresent())
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        int held = customer.getHeldPoints() == null ? 0 : customer.getHeldPoints();
        if (balance < 0 || held < 0 || held > balance || reverse < 0 || redeemed < 0)
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        long credited = (long) balance + redeemed;
        int deduction = (int) Math.min(reverse, Math.max(0L, credited - held));
        int next = Math.toIntExact(credited - deduction);
        String actor = currentActor();
        LoyaltyLedgerEntry reverseEntry = LoyaltyLedgerEntry.builder().customer(customer)
                .type(LoyaltyEntryType.RETURN_REVERSE).points(deduction).orderId(order.getId()).sourceKey(key)
                .reasonCode("HOAN_DON").note("Thu hồi điểm đơn trả; thiếu " + (reverse - deduction) + " điểm")
                .actor(actor).occurredAt(LocalDateTime.now()).build();
        LoyaltyLedgerEntry redeemEntry = redeemed == 0 ? null : LoyaltyLedgerEntry.builder().customer(customer)
                .type(LoyaltyEntryType.RETURN_REDEEM).points(redeemed).orderId(order.getId())
                .sourceKey("return-redeem:" + returnId).reasonCode("HOAN_DON").note("Hoàn điểm đã đổi")
                .actor(actor).occurredAt(LocalDateTime.now()).build();
        return new ReturnSettlement(customer, next, reverse - deduction, reverseEntry, redeemEntry);
    }

    /** Only final writes. The plan holds the locked, validated customer and immutable ledger rows. */
    @Transactional
    public int applyReturn(ReturnSettlement plan) {
        if (plan.customer() == null) return 0;
        plan.customer().setAccumulatePoint(plan.balance());
        if (plan.redeemEntry() != null) ledgerRepository.save(plan.redeemEntry());
        ledgerRepository.save(plan.reverseEntry());
        return plan.shortfall();
    }

    @Transactional
    public int settleReturn(Order order, Long returnId, int reverse, int redeemed) {
        return applyReturn(prepareReturn(order, returnId, reverse, redeemed));
    }

    private void appendLedger(Customer customer, LoyaltyEntryType type, int points, Long orderId, String sourceKey) {
        appendLedger(customer, type, points, orderId, sourceKey, null, null, null);
    }

    private LoyaltyLedgerEntry appendLedger(Customer customer, LoyaltyEntryType type, int points, Long orderId,
            String sourceKey, String reasonCode, String note, String actor) {
        LoyaltyLedgerEntry existing = ledgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), sourceKey).orElse(null);
        if (existing != null) return existing;
        return ledgerRepository.save(LoyaltyLedgerEntry.builder().customer(customer).type(type).points(points)
                .orderId(orderId).sourceKey(sourceKey).reasonCode(reasonCode).note(note).actor(actor)
                .occurredAt(LocalDateTime.now()).build());
    }

    private static boolean positive(Integer points) { return points != null && points > 0; }

    private LoyaltyBalanceResponse balance(Customer customer) {
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        int held = customer.getHeldPoints() == null ? 0 : customer.getHeldPoints();
        boolean opening = ledgerRepository.existsByCustomer_IdAndType(customer.getId(), LoyaltyEntryType.OPENING);
        if (balance < 0 || held < 0 || held > balance) throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        SalesSummary sales = salesSummary(customer);
        LoyaltyPolicySnapshot policy = currentPolicy();
        return LoyaltyBalanceResponse.builder().customerId(customer.getId()).balancePoints(balance)
                .heldPoints(held).availablePoints(balance - held)
                .cumulativePaidSales(sales.paidSales()).salesTierId(sales.tier() == null ? null : sales.tier().getId())
                .salesTierName(sales.tier() == null ? null : sales.tier().getTierName())
                .salesTierStatus(sales.status()).openingRecorded(opening).policyStatus(policy.status())
                .currentPolicyId(policy.id()).currentPolicyVersion(policy.version()).build();
    }

    public void enrichCustomerProfile(CustomerRes response, Customer customer) {
        SalesSummary sales = salesSummary(customer);
        response.setCumulativePaidSales(sales.paidSales());
        response.setSalesTierId(sales.tier() == null ? null : sales.tier().getId());
        response.setSalesTierName(sales.tier() == null ? null : sales.tier().getTierName());
        response.setSalesTierStatus(sales.status());
    }

    private SalesSummary salesSummary(Customer customer) {
        BigDecimal paidSales = Boolean.TRUE.equals(customer.getSalesHistoryComplete())
                ? moneyOrZero(invoiceRepository.sumActualPaidByCustomerAndStatus(customer.getId(),
                        com.springboot.fasearch.common.enums.PaymentStatus.PAID)) : null;
        List<MembershipTier> configured = tierRepository.findAll().stream()
                .filter(tier -> tier.getMinimumCumulativePaidSales() != null).toList();
        if (paidSales == null) return new SalesSummary(null, "HISTORY_UNKNOWN", null);
        if (configured.isEmpty()) return new SalesSummary(paidSales, "NO_CONFIGURED_THRESHOLDS", null);
        MembershipTier tier = configured.stream()
                .filter(row -> row.getMinimumCumulativePaidSales().compareTo(paidSales) <= 0)
                .max(Comparator.comparing(MembershipTier::getMinimumCumulativePaidSales)
                        .thenComparing(MembershipTier::getId)).orElse(null);
        return new SalesSummary(paidSales, "KNOWN", tier);
    }

    private LoyaltyPolicySnapshot currentPolicy() {
        return currentPolicy(false);
    }

    private LoyaltyPolicySnapshot currentPolicy(boolean lock) {
        LoyaltyPolicy policy = lock
                ? policyRepository.findByStatusForUpdate(LoyaltyPolicyStatus.ENABLED).orElseGet(() -> policyRepository.findAllForUpdate()
                        .stream().findFirst().orElse(null))
                : policyRepository.findFirstByStatusOrderByIdDesc(LoyaltyPolicyStatus.ENABLED)
                        .orElseGet(() -> policyRepository.findFirstByOrderByIdDesc().orElse(null));
        if (policy == null) return new LoyaltyPolicySnapshot(null, null, null, null, "UNCONFIGURED");
        LoyaltyPolicyVersion version = policyVersionRepository.findByPolicyIdAndVersion(policy.getId(), policy.getCurrentVersion())
                .orElseThrow(() -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR));
        return new LoyaltyPolicySnapshot(policy.getId(), policy.getCurrentVersion(),
                version.getEarnCurrencyPerPoint(), version.getRedeemCurrencyPerPoint(), policy.getStatus().name());
    }

    private void disableActivePolicy(Long exceptId) {
        LoyaltyPolicy active = policyRepository.findByStatusForUpdate(LoyaltyPolicyStatus.ENABLED).orElse(null);
        if (active != null && !active.getId().equals(exceptId)) {
            active.setStatus(LoyaltyPolicyStatus.DISABLED);
            policyRepository.saveAndFlush(active);
        }
    }

    private LoyaltyPolicyResponse policyResponse(LoyaltyPolicyVersion version, LoyaltyPolicy policy) {
        String status = policy != null && Objects.equals(policy.getCurrentVersion(), version.getVersion())
                ? policy.getStatus().name() : LoyaltyPolicyStatus.DISABLED.name();
        return LoyaltyPolicyResponse.builder().policyId(version.getPolicyId()).version(version.getVersion())
                .earnCurrencyPerPoint(version.getEarnCurrencyPerPoint())
                .redeemCurrencyPerPoint(version.getRedeemCurrencyPerPoint()).status(status)
                .createdAt(version.getCreatedAt()).build();
    }

    private LedgerItemResponse ledgerResponse(LoyaltyLedgerEntry entry) {
        return LedgerItemResponse.builder().entryId(entry.getId()).type(entry.getType()).points(entry.getPoints())
                .orderId(entry.getOrderId()).occurredAt(entry.getOccurredAt()).build();
    }

    private SalesTierResponse tierResponse(MembershipTier tier) {
        return SalesTierResponse.builder().tierId(tier.getId()).name(tier.getTierName())
                .minimumCumulativePaidSales(tier.getMinimumCumulativePaidSales())
                .version(tier.getSalesTierVersion()).build();
    }

    private static BigDecimal validateRate(BigDecimal rate, String field) {
        if (rate == null || rate.signum() <= 0) throw fieldError(field, "must be greater than zero");
        return money(rate, field);
    }

    private static BigDecimal money(BigDecimal value, String field) {
        if (value == null || value.signum() < 0) throw fieldError(field, "must be non-negative");
        try {
            BigDecimal scaled = value.setScale(2, RoundingMode.UNNECESSARY);
            if (scaled.precision() > 19) throw fieldError(field, "exceeds DECIMAL(19,2)");
            return scaled;
        } catch (ArithmeticException ex) {
            throw fieldError(field, "must have at most two fractional digits");
        }
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        return value == null ? ZERO_MONEY : value.setScale(2, RoundingMode.HALF_UP);
    }

    private static LoyaltyPolicyStatus normalizeStatus(String raw) {
        try {
            return LoyaltyPolicyStatus.valueOf(raw == null ? "" : raw.strip().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw fieldError("status", "must be ENABLED or DISABLED");
        }
    }

    private static AppException fieldError(String field, String reason) {
        return new AppException(ErrorCode.INVALID_REQUEST, "Dữ liệu không hợp lệ.",
                List.of(new FieldErrorDetail(field, reason)));
    }

    private record LoyaltyPolicySnapshot(Long id, Long version, BigDecimal earnRate,
            BigDecimal redeemRate, String status) {}
    private record SalesSummary(BigDecimal paidSales, String status, MembershipTier tier) {}
}
