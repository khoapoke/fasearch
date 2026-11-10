package com.springboot.fasearch.modules.analytics.dto.response;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueTimelineItem {

    private String date;
    private BigDecimal revenue;
    private long orders;
}
