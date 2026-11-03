package com.springboot.fasearch.modules.loyalty.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SalesTierUpdateRequest {
    @NotNull @PositiveOrZero
    private Long version;
    @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2)
    private BigDecimal minimumCumulativePaidSales;
}
