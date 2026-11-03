package com.springboot.fasearch.modules.payment.dto.request;

import java.math.BigDecimal;

import com.springboot.fasearch.common.enums.PaymentMethodType;

import jakarta.validation.constraints.Size;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class PaymentProcessReq {

    @NotNull(message = "Mã đơn hàng không được để trống")
    private Long orderId;

    @NotNull(message = "Phương thức thanh toán không được để trống")
    private PaymentMethodType paymentMethodCode;

    @NotNull(message = "Số tiền thanh toán không được để trống")
    @DecimalMin(value = "0.0", inclusive = true, message = "Số tiền thanh toán phải lớn hơn hoặc bằng 0")
    private BigDecimal amountPaid;

    private String note;

    @Size(max = 50)
    private String voucherCode;

    @DecimalMin(value = "0", message = "Redeemed points must be non-negative")
    private BigDecimal redeemedPoints;

    @Size(max = 64)
    private String quoteFingerprint;
}
