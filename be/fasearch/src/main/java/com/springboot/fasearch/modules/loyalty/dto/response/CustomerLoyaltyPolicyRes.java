package com.springboot.fasearch.modules.loyalty.dto.response;

import java.util.List;

import lombok.Builder;
import lombok.Getter;

/** Customer-safe policy/tier projection; no admin controls or internal counters. */
@Getter
@Builder
public class CustomerLoyaltyPolicyRes {
    private LoyaltyBalanceResponse balance;
    private LoyaltyPolicyResponse policy;
    private List<SalesTierResponse> tiers;
}
