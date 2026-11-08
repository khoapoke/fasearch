package com.springboot.fasearch.modules.order.service.impl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Component;

import com.springboot.fasearch.modules.order.dto.response.OrderItemRes;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.shared.history.HistoryNameLookup;

import lombok.RequiredArgsConstructor;

/**
 * Dòng hàng của chứng từ đơn hàng.
 *
 * <p>Tên sản phẩm, màu, cỡ và ảnh được đọc từ ảnh chụp SQL gốc theo mã SKU, không đọc qua
 * quan hệ JPA — SKU hoặc sản phẩm đã xóa mềm vẫn hiển thị được tên thay vì làm hỏng trang đơn cũ.
 */
@Component
@RequiredArgsConstructor
public class OrderItemHistoryBuilder {

    private final HistoryNameLookup historyNameLookup;

    public List<OrderItemRes> build(List<OrderDetail> details) {
        if (details == null || details.isEmpty()) {
            return new ArrayList<>();
        }
        List<Long> skuIds = details.stream()
                .map(OrderItemHistoryBuilder::skuIdOf)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, HistoryNameLookup.HistoryName> snapshots = historyNameLookup.bySkuIds(skuIds);

        List<OrderItemRes> items = new ArrayList<>();
        for (OrderDetail detail : details) {
            Long skuId = skuIdOf(detail);
            HistoryNameLookup.HistoryName name = historyNameLookup.of(snapshots, skuId);
            int quantity = detail.getQuantity() == null ? 0 : detail.getQuantity();
            BigDecimal unitPrice = detail.getUnitPrice() == null ? BigDecimal.ZERO : detail.getUnitPrice();
            items.add(OrderItemRes.builder()
                    .skuId(skuId)
                    .productName(name.productName())
                    .color(name.color())
                    .size(name.size())
                    .imageUrl(name.imageUrl())
                    .quantity(detail.getQuantity())
                    .unitPrice(detail.getUnitPrice())
                    .totalPrice(unitPrice.multiply(BigDecimal.valueOf(quantity)))
                    .discountAmount(detail.getDiscountAmount())
                    .pointsDiscountAmount(detail.getPointsDiscountAmount())
                    .build());
        }
        return items;
    }

    private static Long skuIdOf(OrderDetail detail) {
        return detail.getVariant() == null ? null : detail.getVariant().getId();
    }
}
