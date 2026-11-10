package com.springboot.fasearch.modules.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProviderCheckoutReq {
    @NotNull
    private Long orderId;

    @NotBlank
    @Size(max = 100)
    private String idempotencyKey;
}
