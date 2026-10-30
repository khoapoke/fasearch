package com.springboot.fasearch.modules.order.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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
public class OrderDetailRes {

    private Long orderId;
    private String orderCode;
    private OrderStatus status;
    private OrderCustomerRes customer;
    private String deliveryAddress;
    private String note;
    private List<OrderItemRes> items;
    private BigDecimal subTotal;
    private BigDecimal discountAmount;
    private Long voucherId;
    private String voucherCode;
    private String voucherCampaignName;
    private Long voucherCampaignVersion;
    private BigDecimal shippingFee;
    private BigDecimal totalAmount;
    private LocalDateTime createdAt;
}
