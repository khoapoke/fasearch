package com.springboot.fasearch.modules.khuyenmai.service.interfaces;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;
import com.springboot.fasearch.modules.khuyenmai.entity.KhuyenMai;
import com.springboot.fasearch.modules.khuyenmai.entity.MaGiamGia;
import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;

public interface CheckoutBenefitService {
    record Application(MaGiamGia voucher, KhuyenMai campaign, Map<Long, BigDecimal> discountBySku,
            BigDecimal discount, String fingerprint, LoyaltyService.QuoteSnapshot loyaltyQuote) {}

    CartQuoteResponse quote(List<CartItem> items, Long customerId, String voucherCode, int redeemedPoints);
    CartQuoteResponse quoteOrder(List<OrderDetail> lines, Long orderId, Long customerId, String voucherCode, int redeemedPoints);

    default CartQuoteResponse quote(List<CartItem> items, String voucherCode) {
        return quote(items, null, voucherCode, 0);
    }

    Application prepareCheckout(List<OrderDetail> lines, Long customerId, String voucherCode, int redeemedPoints,
            String quoteFingerprint, BigDecimal expectedMerchandiseAmountDue);
    Application preparePosPayment(List<OrderDetail> lines, Long customerId, String voucherCode, int redeemedPoints,
            String quoteFingerprint);

    default Application prepareCheckout(List<OrderDetail> lines, String voucherCode, String quoteFingerprint,
            BigDecimal expectedMerchandiseAmountDue) {
        return prepareCheckout(lines, null, voucherCode, 0, quoteFingerprint, expectedMerchandiseAmountDue);
    }
    void recordHold(Long orderId, Application application);
    void release(Long orderId);
    void consume(Long orderId);
    void requireConsumed(Long orderId);
    void applySnapshot(Order order, Application application);
}
