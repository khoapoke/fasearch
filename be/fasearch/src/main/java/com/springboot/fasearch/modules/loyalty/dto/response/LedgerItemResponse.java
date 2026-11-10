package com.springboot.fasearch.modules.loyalty.dto.response;

import java.time.LocalDateTime;

import com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LedgerItemResponse {
    private Long entryId;
    private LoyaltyEntryType type;
    private Integer points;
    private Long orderId;
    private LocalDateTime occurredAt;
}
