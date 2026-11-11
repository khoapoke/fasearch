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
public class RevenueSummaryRes {

    private BigDecimal totalRevenue;
    private long totalOrders;
    private BigDecimal averageOrderValue;
    /** Always null: the schema keeps no cost history. See coverage.cogsNote. */
    private BigDecimal totalCogs;
    /** Always null: the schema keeps no cost history. See coverage.cogsNote. */
    private BigDecimal grossProfit;
}
