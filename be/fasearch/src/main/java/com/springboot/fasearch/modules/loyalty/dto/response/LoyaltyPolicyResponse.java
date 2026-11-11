package com.springboot.fasearch.modules.loyalty.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoyaltyPolicyResponse {
    private Long policyId;
    private Long version;
    private BigDecimal earnCurrencyPerPoint;
    private BigDecimal redeemCurrencyPerPoint;
    private String status;
    private LocalDateTime createdAt;
}
