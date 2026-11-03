package com.springboot.fasearch.modules.payment.attempt.dto.request;

import com.springboot.fasearch.modules.payment.attempt.entity.PaymentProvider;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PaymentAttemptCreateReq {
    @NotNull
    private Long orderId;

    @NotNull
    private PaymentProvider provider;

    @NotBlank
    @Size(max = 100)
    private String idempotencyKey;
}
