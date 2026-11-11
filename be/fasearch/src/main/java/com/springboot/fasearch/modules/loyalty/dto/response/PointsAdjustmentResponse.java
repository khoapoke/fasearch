package com.springboot.fasearch.modules.loyalty.dto.response;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PointsAdjustmentResponse {
    private Long entryId;
    private Long customerId;
    private Integer delta;
    private Integer balanceBefore;
    private Integer balanceAfter;
    private String reasonCode;
    private LocalDateTime occurredAt;
    /** True when the same requestId had already been applied and nothing new was written. */
    private boolean replayed;
}
