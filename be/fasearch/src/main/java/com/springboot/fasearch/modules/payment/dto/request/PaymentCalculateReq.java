package com.springboot.fasearch.modules.payment.dto.request;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
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
public class PaymentCalculateReq {

    @NotNull(message = "Mã đơn hàng không được để trống")
    private Long orderId;

    private String voucherCode;

    @DecimalMin(value = "0", message = "Redeemed points must be non-negative")
    private BigDecimal redeemedPoints;
}
