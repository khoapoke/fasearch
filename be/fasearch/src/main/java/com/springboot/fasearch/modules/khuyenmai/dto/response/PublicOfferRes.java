package com.springboot.fasearch.modules.khuyenmai.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Public-safe offer projection; no admin counters, targets or internal scope. */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicOfferRes {
    private Long campaignId;
    private String title;
    private String discountType;
    private BigDecimal discountValue;
    private String conditionText;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String code;
}
