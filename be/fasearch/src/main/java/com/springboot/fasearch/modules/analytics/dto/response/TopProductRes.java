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
public class TopProductRes {

    private int rank;
    private Long productId;
    private String productName;
    private String categoryName;
    private long totalQuantitySold;
    private BigDecimal totalRevenue;
    private long currentInventory;
    /** True when the product row is soft-deleted; attribution kept, flagged. */
    private boolean softDeleted;
}
