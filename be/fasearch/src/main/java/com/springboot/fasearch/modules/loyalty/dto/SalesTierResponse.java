package com.springboot.fasearch.modules.loyalty.dto;

import java.math.BigDecimal;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SalesTierResponse {
    private Long tierId;
    private String name;
    private BigDecimal minimumCumulativePaidSales;
    private Long version;
}
