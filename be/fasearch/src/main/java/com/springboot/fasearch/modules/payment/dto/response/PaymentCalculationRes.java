package com.springboot.fasearch.modules.payment.dto.response;

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
public class PaymentCalculationRes {

    private BigDecimal subTotal;
    private BigDecimal voucherDiscount;
    private BigDecimal pointDiscount;
    private BigDecimal shippingFee;
    private BigDecimal taxVat;
    private BigDecimal finalAmount;
}
