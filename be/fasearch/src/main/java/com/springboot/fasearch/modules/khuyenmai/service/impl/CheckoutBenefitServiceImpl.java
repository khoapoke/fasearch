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

    @Override
    @Transactional(readOnly = true)
    public CartQuoteResponse quote(List<CartItem> items, String voucherCode) {
        Plan plan = plan(cartLines(items), voucherCode, false);
        List<CartQuoteLineResponse> responseLines = plan.lines().stream().map(line ->
                CartQuoteLineResponse.builder().skuId(line.skuId()).productName(line.productName())
                        .quantity(line.quantity()).unitPrice(money(line.unitPrice())).totalPrice(money(line.subtotal()))
                        .discountAmount(plan.discounts().getOrDefault(line.skuId(), BigDecimal.ZERO.setScale(2))).build())
                .toList();
        BigDecimal subtotal = plan.lines().stream().map(PricedLine::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        return CartQuoteResponse.builder().items(responseLines).subTotal(money(subtotal))
                .voucherCode(plan.voucher() == null ? null : plan.voucher().getCode())
                .voucherDiscount(plan.discount()).merchandiseAmountDue(money(subtotal.subtract(plan.discount())))
                .quoteFingerprint(plan.fingerprint()).build();
    }

    @Override
    @Transactional
    public Application prepareCheckout(List<OrderDetail> orderLines, String voucherCode, String quoteFingerprint,
            BigDecimal expectedMerchandiseAmountDue) {
        boolean hasFingerprint = quoteFingerprint != null && !quoteFingerprint.isBlank();
        boolean hasExpected = expectedMerchandiseAmountDue != null;
        if (hasFingerprint != hasExpected) throw new AppException(ErrorCode.INVALID_REQUEST, "Quote token and expected amount must be sent together");
        boolean hasVoucher = voucherCode != null && !voucherCode.isBlank();
        if (hasVoucher && !hasFingerprint) throw new AppException(ErrorCode.INVALID_REQUEST, "A fresh quote is required for voucher checkout");
        Plan plan = plan(orderLines(orderLines), voucherCode, true);
        if (hasFingerprint && (!quoteFingerprint.equals(plan.fingerprint())
                || expectedMerchandiseAmountDue.compareTo(merchandiseDue(plan.lines(), plan.discount())) != 0)) {
            throw new AppException(ErrorCode.QUOTE_CHANGED);
        }
        return new Application(plan.voucher(), plan.campaign(), plan.discounts(), plan.discount(), plan.fingerprint());
    }

    @Override
    @Transactional
    public void recordHold(Long orderId, Application application) {
        if (application.voucher() == null) return;
        MaGiamGia voucher = application.voucher(); // locked by prepareCheckout in the caller transaction
        if (voucher.getIssued() != null && count(voucher.getUsed()) + count(voucher.getHeld()) >= voucher.getIssued()) {
            throw new AppException(ErrorCode.VOUCHER_EXHAUSTED);
        }
        voucher.setHeld(count(voucher.getHeld()) + 1);
        codeRepository.save(voucher);
        usageRepository.save(VoucherUsage.builder().orderId(orderId).voucherId(voucher.getId())
                .discount(application.discount()).status("HELD").updatedAt(LocalDateTime.now()).build());
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
            throw new AppException(ErrorCode.INVALID_REQUEST, "COD must be settled before completing this order");
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
    }

    private void transition(Long orderId, boolean consume) {
        VoucherUsage usage = usageRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (usage == null || !"HELD".equals(usage.getStatus())) return;
        MaGiamGia voucher = codeRepository.findByIdForUpdate(usage.getVoucherId())
                .orElseThrow(() -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR));
        if (count(voucher.getHeld()) <= 0) throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Voucher hold counter underflow");
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
            if (normalizedCode.length() > 50) throw new AppException(ErrorCode.INVALID_REQUEST, "Voucher code must be at most 50 characters");
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
        return details.stream().map(detail -> line(detail.getVariant(), detail.getQuantity())).toList();
    }

    private PricedLine line(ProductVariant variant, int quantity) {
        BigDecimal base = variant.getProduct().getPrice();
        BigDecimal surcharge = variant.getAdditionalPrice() == null ? BigDecimal.ZERO : variant.getAdditionalPrice();
        BigDecimal unit = money(base.add(surcharge));
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

    private static BigDecimal merchandiseDue(List<PricedLine> lines, BigDecimal discount) {
        return money(lines.stream().map(PricedLine::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add).subtract(discount));
    }
    private static int count(Integer value) { return value == null ? 0 : value; }
    private static BigDecimal money(BigDecimal value) { return value.setScale(2, RoundingMode.HALF_UP); }
}
