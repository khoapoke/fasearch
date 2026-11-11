package com.springboot.fasearch.modules.loyalty.dto.response;

import java.time.LocalDateTime;

import com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType;

import lombok.Builder;
import lombok.Getter;

/** Staff view of one ledger row, including internal reason, note and actor. */
@Getter
@Builder
public class AdminLedgerItemResponse {
    private Long entryId;
    private LoyaltyEntryType type;
    /** Stored points: a magnitude, except ADJUST which is signed. */
    private Integer points;
    /** Signed effect on the balance; 0 for OPENING, HOLD and RELEASE. */
    private Integer delta;
    /** Balance right after this row, derived from the current balance and the newer rows. */
    private Integer balanceAfter;
    private Long orderId;
    private String orderCode;
    private String reasonCode;
    private String note;
    private String actor;
    private LocalDateTime occurredAt;
}
