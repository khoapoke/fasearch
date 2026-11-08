package com.springboot.fasearch.modules.khuyenmai.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteLineResponse;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;
import com.springboot.fasearch.modules.khuyenmai.entity.KhuyenMai;
import com.springboot.fasearch.modules.khuyenmai.entity.MaGiamGia;
import com.springboot.fasearch.modules.khuyenmai.entity.VoucherUsage;
import com.springboot.fasearch.modules.khuyenmai.repository.KhuyenMaiRepository;
import com.springboot.fasearch.modules.khuyenmai.repository.MaGiamGiaRepository;
import com.springboot.fasearch.modules.khuyenmai.repository.VoucherUsageRepository;
import com.springboot.fasearch.modules.khuyenmai.service.VoucherMath;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.loyalty.service.LoyaltyMath;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.product.entity.ProductVariant;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CheckoutBenefitServiceImpl implements CheckoutBenefitService {
    private record PricedLine(Long skuId, Long productId, String productName, int quantity,
            BigDecimal unitPrice, BigDecimal subtotal) {}
    private record Plan(MaGiamGia voucher, KhuyenMai campaign, List<PricedLine> lines,
            Map<Long, BigDecimal> discounts, BigDecimal discount, String fingerprint) {}

    private final KhuyenMaiRepository campaignRepository;
    private final MaGiamGiaRepository codeRepository;
    private final VoucherUsageRepository usageRepository;
    private final LoyaltyService loyaltyService;

    @Override
    @Transactional(readOnly = true)
    public CartQuoteResponse quote(List<CartItem> items, Long customerId, String voucherCode, int redeemedPoints) {
        return quotePlan(plan(cartLines(items), voucherCode, false), null, customerId, redeemedPoints);
    }

    @Override
    @Transactional(readOnly = true)
    public CartQuoteResponse quoteOrder(List<OrderDetail> lines, Long orderId, Long customerId,
            String voucherCode, int redeemedPoints) {
        return quotePlan(plan(orderLines(lines), voucherCode, false), orderId, customerId, redeemedPoints);
    }

    private CartQuoteResponse quotePlan(Plan plan, Long orderId, Long customerId, int redeemedPoints) {
        BigDecimal subtotal = subtotal(plan.lines());
        BigDecimal remaining = money(subtotal.subtract(plan.discount()));
        LoyaltyService.QuoteSnapshot points = loyaltyService.quote(customerId, redeemedPoints, remaining, postVoucherLines(plan));
        BigDecimal due = money(remaining.subtract(points.pointsDiscount()));
        List<CartQuoteLineResponse> responseLines = plan.lines().stream().map(line ->
                CartQuoteLineResponse.builder().skuId(line.skuId()).productName(line.productName())
                        .quantity(line.quantity()).unitPrice(money(line.unitPrice())).totalPrice(money(line.subtotal()))
                        .discountAmount(plan.discounts().getOrDefault(line.skuId(), BigDecimal.ZERO.setScale(2)))
                        .pointsDiscountAmount(points.pointsDiscountBySku().getOrDefault(line.skuId(), BigDecimal.ZERO.setScale(2)))
                        .build()).toList();
        return CartQuoteResponse.builder().orderId(orderId).items(responseLines).subTotal(money(subtotal))
                .voucherCode(plan.voucher() == null ? null : plan.voucher().getCode())
                .freeShipping(plan.campaign() != null && "FREE_SHIP".equals(plan.campaign().getDiscountType()))
                .voucherDiscount(plan.discount()).remainingMerchandiseAmount(remaining)
                .redeemedPoints(points.redeemedPoints()).pointsDiscount(points.pointsDiscount())
                .allowedRedeemedPoints(points.allowedRedeemedPoints()).availablePoints(points.availablePoints())
                .policyStatus(points.policyStatus()).loyaltyPolicyId(points.policyId())
                .loyaltyPolicyVersion(points.policyVersion()).redeemCurrencyPerPoint(points.redeemRate())
                .merchandiseAmountDue(due).quoteFingerprint(combinedFingerprint(plan.fingerprint(), points, customerId, due))
                .build();
    }

    @Override
    @Transactional
    public Application prepareCheckout(List<OrderDetail> orderLines, Long customerId, String voucherCode,
            int redeemedPoints, String quoteFingerprint, BigDecimal expectedMerchandiseAmountDue) {
        return prepare(orderLines, customerId, voucherCode, redeemedPoints, quoteFingerprint,
                expectedMerchandiseAmountDue, true);
    }

    @Override
    @Transactional
    public Application preparePosPayment(List<OrderDetail> orderLines, Long customerId, String voucherCode,
            int redeemedPoints, String quoteFingerprint) {
        return prepare(orderLines, customerId, voucherCode, redeemedPoints, quoteFingerprint, null, false);
    }

    private Application prepare(List<OrderDetail> orderLines, Long customerId, String voucherCode,
            int redeemedPoints, String quoteFingerprint, BigDecimal expectedMerchandiseAmountDue,
            boolean requireExpectedAmount) {
        boolean hasFingerprint = quoteFingerprint != null && !quoteFingerprint.isBlank();
        boolean hasExpected = expectedMerchandiseAmountDue != null;
        if (requireExpectedAmount ? hasFingerprint != hasExpected : hasExpected) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Token báo giá và số tiền dự kiến phải được gửi cùng nhau.");
        }
        boolean hasVoucher = voucherCode != null && !voucherCode.isBlank();
        if ((hasVoucher || redeemedPoints > 0) && !hasFingerprint) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cần báo giá mới cho ưu đãi khi thanh toán.");
        }
        Plan plan = plan(orderLines(orderLines), voucherCode, true);
        BigDecimal subtotal = subtotal(plan.lines());
        BigDecimal remaining = money(subtotal.subtract(plan.discount()));
        LoyaltyService.QuoteSnapshot points = loyaltyService.quoteForCommit(customerId, redeemedPoints,
                remaining, postVoucherLines(plan));
        BigDecimal due = money(remaining.subtract(points.pointsDiscount()));
        String fingerprint = combinedFingerprint(plan.fingerprint(), points, customerId, due);
        if (hasFingerprint && (!quoteFingerprint.equals(fingerprint)
                || (hasExpected && expectedMerchandiseAmountDue.compareTo(due) != 0))) {
            throw new AppException(ErrorCode.QUOTE_CHANGED);
        }
        return new Application(plan.voucher(), plan.campaign(), plan.discounts(), plan.discount(), fingerprint, points);
    }

    @Override
    @Transactional
    public void recordHold(Long orderId, Application application) {
        if (application.voucher() != null) {
            MaGiamGia voucher = application.voucher(); // locked by prepareCheckout in the caller transaction
            if (voucher.getIssued() != null && count(voucher.getUsed()) + count(voucher.getHeld()) >= voucher.getIssued()) {
                throw new AppException(ErrorCode.VOUCHER_EXHAUSTED);
            }
            voucher.setHeld(count(voucher.getHeld()) + 1);
            codeRepository.save(voucher);
            usageRepository.save(VoucherUsage.builder().orderId(orderId).voucherId(voucher.getId())
                    .discount(application.discount()).status("HELD").updatedAt(LocalDateTime.now()).build());
        }
        loyaltyService.holdOrder(orderId, application.loyaltyQuote());
    }

    @Override
    @Transactional
    public void release(Long orderId) { transition(orderId, false); }

    @Override
    @Transactional
    public void consume(Long orderId) { transition(orderId, true); }

    @Override
    @Transactional(readOnly = true)
    public void requireConsumed(Long orderId) {
        VoucherUsage usage = usageRepository.findById(orderId).orElse(null);
        if (usage != null && !"CONSUMED".equals(usage.getStatus())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "COD phải được thu đủ trước khi hoàn tất đơn này.");
        }
    }

    @Override
    public void applySnapshot(Order order, Application application) {
        order.setVoucherId(application.voucher() == null ? null : application.voucher().getId());
        order.setVoucherCode(application.voucher() == null ? null : application.voucher().getCode());
        order.setVoucherCampaignName(application.campaign() == null ? null : application.campaign().getName());
        order.setVoucherCampaignVersion(application.campaign() == null ? null : application.campaign().getVersion());
        order.setVoucherDiscountType(application.campaign() == null ? null : application.campaign().getDiscountType());
        order.setVoucherDiscountValue(application.campaign() == null ? null : application.campaign().getDiscountValue());
        order.setDiscountAmount(application.discount());
        LoyaltyService.QuoteSnapshot points = application.loyaltyQuote();
        order.setRedeemedPoints(points.redeemedPoints());
        order.setPointsDiscount(points.pointsDiscount());
        boolean snapshot = points.customerId() != null && points.policyId() != null
                && "ENABLED".equals(points.policyStatus());
        order.setLoyaltyPolicyId(snapshot ? points.policyId() : null);
        order.setLoyaltyPolicyVersion(snapshot ? points.policyVersion() : null);
        order.setRedeemCurrencyPerPointSnapshot(snapshot ? points.redeemRate() : null);
        order.setLoyaltyQuoteFingerprint(application.fingerprint());
        order.setEarnedPoints(null);
    }

    private void transition(Long orderId, boolean consume) {
        VoucherUsage usage = usageRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (usage == null || !"HELD".equals(usage.getStatus())) return;
        MaGiamGia voucher = codeRepository.findByIdForUpdate(usage.getVoucherId())
                .orElseThrow(() -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR));
        if (count(voucher.getHeld()) <= 0) throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Bộ đếm giữ Voucher bị âm.");
        voucher.setHeld(voucher.getHeld() - 1);
        if (consume) voucher.setUsed(count(voucher.getUsed()) + 1);
        codeRepository.save(voucher);
        usage.setStatus(consume ? "CONSUMED" : "RELEASED");
        usage.setUpdatedAt(LocalDateTime.now());
        usageRepository.save(usage);
    }

    private Plan plan(List<PricedLine> inputLines, String rawCode, boolean lock) {
        List<PricedLine> lines = new ArrayList<>(inputLines);
        lines.sort(Comparator.comparing(PricedLine::skuId));
        Map<Long, BigDecimal> discounts = new TreeMap<>();
        for (PricedLine line : lines) discounts.put(line.skuId(), BigDecimal.ZERO.setScale(2));
        BigDecimal discount = BigDecimal.ZERO.setScale(2);
        MaGiamGia voucher = null;
        KhuyenMai campaign = null;
        String normalizedCode = rawCode == null || rawCode.isBlank() ? null : rawCode.strip().toUpperCase(Locale.ROOT);
        if (normalizedCode != null) {
            if (normalizedCode.length() > 50) throw new AppException(ErrorCode.INVALID_REQUEST, "Mã Voucher tối đa 50 ký tự.");
            voucher = (lock ? codeRepository.findByCodeForUpdate(normalizedCode) : codeRepository.findByCodeIgnoreCase(normalizedCode))
                    .orElseThrow(() -> new AppException(lock ? ErrorCode.QUOTE_CHANGED : ErrorCode.VOUCHER_UNKNOWN));
            campaign = (lock ? campaignRepository.findByIdForUpdate(voucher.getCampaignId())
                    : campaignRepository.findById(voucher.getCampaignId()))
                    .orElseThrow(() -> new AppException(lock ? ErrorCode.QUOTE_CHANGED : ErrorCode.VOUCHER_UNKNOWN));
            LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
            if (!"ACTIVE".equalsIgnoreCase(voucher.getStatus()) || "TAM_DUNG".equals(campaign.getStatus())) {
                throw new AppException(lock ? ErrorCode.QUOTE_CHANGED : ErrorCode.VOUCHER_PAUSED);
            }
            if (campaign.getStartAt() == null || campaign.getEndAt() == null) {
                throw new AppException(lock ? ErrorCode.QUOTE_CHANGED : ErrorCode.VOUCHER_NOT_APPLICABLE);
            }
            if (now.isBefore(campaign.getStartAt())) throw new AppException(lock ? ErrorCode.QUOTE_CHANGED : ErrorCode.VOUCHER_NOT_STARTED);
            if (now.isAfter(campaign.getEndAt())) throw new AppException(lock ? ErrorCode.QUOTE_CHANGED : ErrorCode.VOUCHER_EXPIRED);
            if (voucher.getIssued() != null && count(voucher.getUsed()) + count(voucher.getHeld()) >= voucher.getIssued()) {
                throw new AppException(ErrorCode.VOUCHER_EXHAUSTED);
            }
            try {
                VoucherMath.Result result = VoucherMath.calculate(lines.stream()
                        .map(line -> new VoucherMath.Line(line.skuId(), line.productId(), line.subtotal())).toList(),
                        campaign.getProductScope(), campaign.getDiscountType(), campaign.getDiscountValue());
                discounts.putAll(result.discountBySku());
                discount = result.discount();
            } catch (IllegalArgumentException e) {
                throw new AppException(lock ? ErrorCode.QUOTE_CHANGED : ErrorCode.VOUCHER_NOT_APPLICABLE);
            }
        }
        return new Plan(voucher, campaign, lines, discounts, discount,
                fingerprint(lines, normalizedCode, voucher, campaign));
    }

    private List<PricedLine> cartLines(List<CartItem> items) {
        if (items == null || items.isEmpty()) throw new AppException(ErrorCode.CART_EMPTY);
        return items.stream().map(item -> line(item.getVariant(), item.getQuantity())).toList();
    }

    private List<PricedLine> orderLines(List<OrderDetail> details) {
        if (details == null || details.isEmpty()) throw new AppException(ErrorCode.CART_EMPTY);
        return details.stream().map(detail -> line(detail.getVariant(), detail.getQuantity(), detail.getUnitPrice())).toList();
    }

    private PricedLine line(ProductVariant variant, int quantity) {
        BigDecimal base = variant.getProduct().getPrice();
        BigDecimal surcharge = variant.getAdditionalPrice() == null ? BigDecimal.ZERO : variant.getAdditionalPrice();
        return line(variant, quantity, base.add(surcharge));
    }

    private PricedLine line(ProductVariant variant, int quantity, BigDecimal unitPrice) {
        if (unitPrice == null || unitPrice.signum() < 0 || quantity <= 0) {
            throw new AppException(ErrorCode.LOYALTY_STATE_CONFLICT, "Dòng đơn hàng đã lưu không hợp lệ.");
        }
        BigDecimal unit = money(unitPrice);
        return new PricedLine(variant.getId(), variant.getProduct().getId(), variant.getProduct().getProductName(),
                quantity, unit, money(unit.multiply(BigDecimal.valueOf(quantity))));
    }

    private String fingerprint(List<PricedLine> lines, String normalizedCode, MaGiamGia voucher, KhuyenMai campaign) {
        StringBuilder value = new StringBuilder("cart-v1|");
        for (PricedLine line : lines) value.append(line.skuId()).append(':').append(line.productId()).append(':')
                .append(line.quantity()).append(':').append(money(line.unitPrice()).toPlainString()).append(';');
        value.append("code=").append(normalizedCode == null ? "" : normalizedCode);
        if (voucher != null && campaign != null) value.append('|').append(voucher.getId()).append('|')
                .append(campaign.getId()).append('|').append(campaign.getVersion()).append('|')
                .append(campaign.getStatus()).append('|').append(campaign.getDiscountType()).append('|')
                .append(campaign.getDiscountValue().toPlainString()).append('|')
                .append(campaign.getStartAt()).append('|').append(campaign.getEndAt());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private List<LoyaltyMath.Line> postVoucherLines(Plan plan) {
        return plan.lines().stream().map(line -> new LoyaltyMath.Line(line.skuId(),
                money(line.subtotal().subtract(plan.discounts().getOrDefault(line.skuId(), BigDecimal.ZERO.setScale(2))))))
                .toList();
    }

    private BigDecimal subtotal(List<PricedLine> lines) {
        return money(lines.stream().map(PricedLine::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private String combinedFingerprint(String voucherFingerprint, LoyaltyService.QuoteSnapshot points,
            Long customerId, BigDecimal due) {
        StringBuilder value = new StringBuilder("s2-cart-v1|").append(voucherFingerprint)
                .append("|customer=").append(customerId == null ? "" : customerId)
                .append("|points=").append(points.redeemedPoints())
                .append("|allowed=").append(points.allowedRedeemedPoints())
                .append("|available=").append(points.availablePoints() == null ? "" : points.availablePoints())
                .append("|policy=").append(points.policyStatus()).append('|').append(points.policyId())
                .append('|').append(points.policyVersion()).append('|').append(moneyText(points.earnRate()))
                .append('|').append(moneyText(points.redeemRate())).append("|discount=")
                .append(points.pointsDiscount().toPlainString()).append("|due=").append(due.toPlainString());
        points.pointsDiscountBySku().entrySet().stream().sorted(Map.Entry.comparingByKey())
                .forEach(entry -> value.append('|').append(entry.getKey()).append(':').append(entry.getValue().toPlainString()));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static String moneyText(BigDecimal value) { return value == null ? "" : money(value).toPlainString(); }
    private static int count(Integer value) { return value == null ? 0 : value; }
    private static BigDecimal money(BigDecimal value) { return value.setScale(2, RoundingMode.HALF_UP); }
}
