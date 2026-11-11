package com.springboot.fasearch.modules.loyalty.dto.response;

import java.math.BigDecimal;

import lombok.Builder;
import lombok.Getter;

/** Preview (and result) of crediting the missing EARN entry of one order. */
@Getter
@Builder
public class EarnRecalcResponse {
    private Long orderId;
    private String orderCode;
    private Long customerId;
    private boolean eligible;
    /** Why not eligible: NO_CUSTOMER, NOT_PAID, STATUS, ALREADY_EARNED, NO_POLICY, ZERO_POINTS, STATE_CONFLICT. */
    private String reason;
    private BigDecimal paidAmount;
    private Integer points;
    private Long policyId;
    private Long policyVersion;
    private BigDecimal earnCurrencyPerPoint;
    /** ORDER_SNAPSHOT when the order carries its own policy version, otherwise CURRENT_POLICY. */
    private String policySource;
    private Integer balanceBefore;
    private Integer balanceAfter;
    /** True when this call wrote the EARN entry. */
    private boolean applied;
}
