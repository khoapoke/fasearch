package com.springboot.fasearch.modules.payment.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;

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
public class InvoiceRes {

    private Long invoiceId;
    private String invoiceCode;
    private Long orderId;
    private String orderCode;
    private BigDecimal totalActualPaid;
    private BigDecimal vatAmount;
    private BigDecimal cashReceived;
    private BigDecimal cashChange;
    private PaymentStatus paymentStatus;
    private PaymentMethodType paymentMethod;
    private String note;
    private LocalDateTime issuedAt;
}
