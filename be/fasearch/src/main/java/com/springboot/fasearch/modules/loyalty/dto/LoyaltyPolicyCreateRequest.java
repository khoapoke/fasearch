package com.springboot.fasearch.modules.loyalty.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoyaltyPolicyCreateRequest {
    @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2)
    private BigDecimal earnCurrencyPerPoint;
    @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2)
    private BigDecimal redeemCurrencyPerPoint;
    @Pattern(regexp = "(?i)ENABLED|DISABLED")
    private String status = "DISABLED";
}
