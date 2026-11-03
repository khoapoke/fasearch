package com.springboot.fasearch.modules.order.entity;

import java.math.BigDecimal;

import com.springboot.fasearch.modules.product.entity.ProductVariant;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ct_don_hang")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class OrderDetail {

    @EmbeddedId
    @Builder.Default
    private OrderDetailId id = new OrderDetailId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("orderId")
    @JoinColumn(name = "ma_don_hang", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("skuId")
    @JoinColumn(name = "ma_sku", nullable = false)
    private ProductVariant variant;

    @Column(name = "so_luong", nullable = false)
    private Integer quantity;

    @Column(name = "don_gia", precision = 15, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "tien_giam", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "points_discount_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal pointsDiscountAmount = BigDecimal.ZERO;
}
