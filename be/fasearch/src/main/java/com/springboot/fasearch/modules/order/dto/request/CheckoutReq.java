package com.springboot.fasearch.modules.order.dto.request;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
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
public class CheckoutReq {

    private String deliveryAddress;

    private String receiverName;

    private String receiverPhone;

    private String voucherCode;

    private String paymentMethod;

    @DecimalMin(value = "0.0", message = "Shipping fee must be greater than or equal to 0")
    private BigDecimal shippingFee;

    private String note;
}
