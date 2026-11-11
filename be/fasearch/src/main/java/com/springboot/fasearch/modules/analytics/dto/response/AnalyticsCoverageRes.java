package com.springboot.fasearch.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Explicit coverage and limitation notes. Nothing is silently treated as zero. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsCoverageRes {

    private long paidInvoices;
    private long excludedPending;
    private long excludedCancelledUnpaid;
    private long softDeletedProductsAttributed;
    private String channelNote;
    private String cogsNote;
    private String openingStockNote;
}
