package com.springboot.fasearch.modules.payment.dto;

import java.math.BigDecimal;

import com.springboot.fasearch.modules.payment.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.entity.ProviderEventOutcome;

public record PaymentEventCommand(
        PaymentProvider provider,
        String providerEventId,
        String providerReference,
        String payloadSha256,
        BigDecimal amount,
        String currency,
        ProviderEventOutcome outcome) {
}
