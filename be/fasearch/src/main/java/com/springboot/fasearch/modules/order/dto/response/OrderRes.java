package com.springboot.fasearch.modules.order.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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
public class OrderRes {

    private Long orderId;

    private String orderCode;

    private OrderStatus status;

    private String customerName;

    private String customerPhone;

    private String deliveryAddress;

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

    private Boolean replayed;

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
