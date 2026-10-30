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

public interface CheckoutBenefitService {
    record Application(MaGiamGia voucher, KhuyenMai campaign, Map<Long, BigDecimal> discountBySku,
            BigDecimal discount, String fingerprint) {}

    CartQuoteResponse quote(List<CartItem> items, String voucherCode);
    Application prepareCheckout(List<OrderDetail> lines, String voucherCode, String quoteFingerprint,
            BigDecimal expectedMerchandiseAmountDue);
    void recordHold(Long orderId, Application application);
    void release(Long orderId);
    void consume(Long orderId);
    void requireConsumed(Long orderId);
    void applySnapshot(Order order, Application application);
}
