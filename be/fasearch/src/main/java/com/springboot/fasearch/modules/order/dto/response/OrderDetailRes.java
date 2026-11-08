package com.springboot.fasearch.modules.order.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;

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
    private Integer redeemedPoints;
    private BigDecimal pointsDiscount;
    private Long loyaltyPolicyId;
    private Long loyaltyPolicyVersion;
    private BigDecimal redeemCurrencyPerPointSnapshot;
    private Integer earnedPoints;
    private Long voucherId;
    private String voucherCode;
    private String voucherCampaignName;
    private Long voucherCampaignVersion;
    private BigDecimal shippingFee;
    private BigDecimal totalAmount;
    private PaymentStatus paymentStatus;
    private PaymentMethodType paymentMethod;
    private LocalDateTime createdAt;
    private Double deliveryLatitude;
    private Double deliveryLongitude;
    private Double distanceKm;
    private String shippingMethod;

}
