package com.springboot.fasearch.modules.order.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.springboot.fasearch.common.enums.OrderStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderRes {

    private Long orderId;

    private String orderCode;

    private OrderStatus status;

    private String customerName;

    private String customerPhone;

    private String deliveryAddress;

    private BigDecimal subTotal;

    private BigDecimal discountAmount;

    private BigDecimal shippingFee;

    private BigDecimal totalAmount;

    private LocalDateTime createdAt;
}
