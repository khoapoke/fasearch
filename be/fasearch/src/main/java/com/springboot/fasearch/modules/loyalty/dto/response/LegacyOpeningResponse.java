package com.springboot.fasearch.modules.loyalty.dto.response;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LegacyOpeningResponse {
    private Long customerId;
    private boolean openingRecorded;
    private Integer openingPoints;
    private Long entryId;
    private LocalDateTime occurredAt;
}
