package com.springboot.fasearch.modules.khuyenmai.dto.response;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CartQuoteResponse {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Long orderId;
    private List<CartQuoteLineResponse> items;
    private BigDecimal subTotal;
    private String voucherCode;
    private BigDecimal voucherDiscount;
    private BigDecimal remainingMerchandiseAmount;
    private Integer redeemedPoints;
    private BigDecimal pointsDiscount;
    private Integer allowedRedeemedPoints;
    private Integer availablePoints;
    private String policyStatus;
    private Long loyaltyPolicyId;
    private Long loyaltyPolicyVersion;
    private BigDecimal redeemCurrencyPerPoint;
    private BigDecimal merchandiseAmountDue;
    private String quoteFingerprint;
}
