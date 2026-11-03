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
import com.springboot.fasearch.modules.loyalty.dto.LedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.LegacyOpeningRequest;
import com.springboot.fasearch.modules.loyalty.dto.LegacyOpeningResponse;
import com.springboot.fasearch.modules.loyalty.dto.CustomerLoyaltyPolicyRes;
import com.springboot.fasearch.modules.loyalty.dto.LoyaltyBalanceResponse;
import com.springboot.fasearch.modules.loyalty.dto.LoyaltyPolicyCreateRequest;
import com.springboot.fasearch.modules.loyalty.dto.LoyaltyPolicyResponse;
import com.springboot.fasearch.modules.loyalty.dto.LoyaltyPolicyUpdateRequest;
import com.springboot.fasearch.modules.loyalty.dto.SalesTierResponse;
import com.springboot.fasearch.modules.loyalty.dto.SalesTierUpdateRequest;
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
import com.springboot.fasearch.modules.loyalty.service.LoyaltyService;
import com.springboot.fasearch.modules.loyalty.service.LoyaltyService.QuoteSnapshot;
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

    private final UserRepository customerRepository;
    private final MembershipTierRepository tierRepository;
    private final LoyaltyPolicyRepository policyRepository;
    private final LoyaltyPolicyVersionRepository policyVersionRepository;
    private final LoyaltyLedgerRepository ledgerRepository;
    private final LoyaltyOrderHoldRepository holdRepository;
    private final InvoiceRepository invoiceRepository;

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
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Loyalty policy not found"));
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
        int points = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        if (points < 0) throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Legacy point balance is invalid");
        LoyaltyLedgerEntry entry = ledgerRepository.save(LoyaltyLedgerEntry.builder()
                .customer(customer).type(LoyaltyEntryType.OPENING).points(points)
                .sourceKey("opening:" + customer.getId()).occurredAt(LocalDateTime.now()).build());
        return LegacyOpeningResponse.builder().customerId(customer.getId()).openingRecorded(true)
                .openingPoints(points).entryId(entry.getId()).occurredAt(entry.getOccurredAt()).build();
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
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Membership tier not found"));
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
        boolean opened = ledgerRepository.existsByCustomer_IdAndType(customerId, LoyaltyEntryType.OPENING);
        int available = opened ? balance - held : 0;
        LoyaltyPolicySnapshot policy = currentPolicy(lock);
        int allowed = LoyaltyMath.allowed(available, opened,
                LoyaltyPolicyStatus.ENABLED.name().equals(policy.status()),
                remainingMerchandise, policy.redeemRate());
        if (requestedPoints > 0) {
            if (!opened) throw new AppException(ErrorCode.LEGACY_OPENING_REQUIRED);
            if (policy.id() == null) throw new AppException(ErrorCode.LOYALTY_POLICY_UNAVAILABLE);
            if (!LoyaltyPolicyStatus.ENABLED.name().equals(policy.status())) {
                throw new AppException(ErrorCode.LOYALTY_POLICY_DISABLED);
            }
            if (requestedPoints > allowed) {
                throw new AppException(ErrorCode.INSUFFICIENT_POINTS,
                        "Requested points exceed the current allowance",
                        List.of(new FieldErrorDetail("redeemedPoints", "Allowed maximum: " + allowed)));
            }
        }
        BigDecimal discount = requestedPoints == 0 ? ZERO_MONEY : LoyaltyMath.discount(requestedPoints, policy.redeemRate());
        Map<Long, BigDecimal> allocation = LoyaltyMath.allocate(lines, discount);
        return new QuoteSnapshot(requestedPoints, discount, allocation, allowed,
                opened ? available : null, policy.status(), policy.id(), policy.version(),
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
        int earned;
        try {
            earned = LoyaltyMath.earnedPoints(actualPaid == null ? ZERO_MONEY : actualPaid,
                    policy.getEarnCurrencyPerPoint());
        } catch (ArithmeticException ex) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Earned points exceed the supported balance range");
        }
        try { balance = Math.addExact(balance, earned); }
        catch (ArithmeticException ex) { throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT); }
        if (earned > 0) {
            customer.setAccumulatePoint(balance);
            appendLedger(customer, LoyaltyEntryType.EARN, earned, order.getId(), "earn:" + order.getId());
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
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Legacy point award exceeds the supported balance range");
        }
        int pointsEarned = award.intValue();
        int balance = customer.getAccumulatePoint() == null ? 0 : customer.getAccumulatePoint();
        try {
            customer.setAccumulatePoint(Math.addExact(balance, pointsEarned));
        } catch (ArithmeticException ex) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Legacy point balance exceeds the supported range");
        }
        if (opening) appendLedger(customer, LoyaltyEntryType.EARN, pointsEarned, order.getId(), sourceKey);
    }

    @Transactional(readOnly = true)
    public void requireConsumed(Order order) {
        if (!positive(order.getRedeemedPoints())) return;
        LoyaltyOrderHold hold = holdRepository.findById(order.getId()).orElse(null);
        if (hold == null || hold.getStatus() != LoyaltyHoldStatus.CONSUMED) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT);
        }
    }

    private void appendLedger(Customer customer, LoyaltyEntryType type, int points, Long orderId, String sourceKey) {
        if (ledgerRepository.findByCustomer_IdAndSourceKey(customer.getId(), sourceKey).isPresent()) return;
        ledgerRepository.save(LoyaltyLedgerEntry.builder().customer(customer).type(type).points(points)
                .orderId(orderId).sourceKey(sourceKey).occurredAt(LocalDateTime.now()).build());
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
                .heldPoints(held).availablePoints(opening ? balance - held : null)
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
        return new AppException(ErrorCode.INVALID_REQUEST, "Validation failed",
                List.of(new FieldErrorDetail(field, reason)));
    }

    private record LoyaltyPolicySnapshot(Long id, Long version, BigDecimal earnRate,
            BigDecimal redeemRate, String status) {}
    private record SalesSummary(BigDecimal paidSales, String status, MembershipTier tier) {}
}
