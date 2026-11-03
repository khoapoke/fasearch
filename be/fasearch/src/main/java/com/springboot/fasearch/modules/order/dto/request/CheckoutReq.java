package com.springboot.fasearch.modules.order.dto.request;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
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

    @Size(max = 50)
    private String voucherCode;

    @Size(max = 64)
    private String quoteFingerprint;

    @DecimalMin(value = "0.0", message = "Expected merchandise amount must be non-negative")
    private BigDecimal expectedMerchandiseAmountDue;

    @DecimalMin(value = "0", message = "Redeemed points must be non-negative")
    private BigDecimal redeemedPoints;

    @Size(max = 100)
    private String checkoutKey;

    private String paymentMethod;

    @DecimalMin(value = "0.0", message = "Shipping fee must be greater than or equal to 0")
    private BigDecimal shippingFee;

    private String note;
}
