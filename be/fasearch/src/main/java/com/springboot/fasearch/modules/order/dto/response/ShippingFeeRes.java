package com.springboot.fasearch.modules.order.dto.response;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShippingFeeRes {

    private BigDecimal shippingFee;
    private String estimatedDays;
    private Double distanceKm;
    @com.fasterxml.jackson.annotation.JsonProperty("distance_km")
    public Double getDistanceKmAlias() { return distanceKm; }
    private String method;
    private BigDecimal baseFee;
    private BigDecimal shippingDiscount;
    public BigDecimal getFee() { return shippingFee; }
}
