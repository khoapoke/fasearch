package com.springboot.fasearch.modules.loyalty.dto;

import java.math.BigDecimal;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoyaltyBalanceResponse {
    private Long customerId;
    private Integer balancePoints;
    private Integer heldPoints;
    private Integer availablePoints;
    private BigDecimal cumulativePaidSales;
    private Long salesTierId;
    private String salesTierName;
    private String salesTierStatus;
    private boolean openingRecorded;
    private String policyStatus;
    private Long currentPolicyId;
    private Long currentPolicyVersion;
}
