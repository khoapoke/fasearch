package com.springboot.fasearch.modules.payment.attempt.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.springboot.fasearch.modules.payment.attempt.entity.PaymentAttemptStatus;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentProvider;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PaymentAttemptRes {
    private Long id;
    private Long orderId;
    private PaymentProvider provider;
    private PaymentAttemptStatus status;
    private BigDecimal amount;
    private String currency;
    private String providerReference;
    private String checkoutUrl;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
