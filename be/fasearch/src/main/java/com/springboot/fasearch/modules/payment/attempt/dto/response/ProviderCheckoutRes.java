package com.springboot.fasearch.modules.payment.attempt.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProviderCheckoutRes {
    private Long attemptId;
    private String checkoutUrl;
}
