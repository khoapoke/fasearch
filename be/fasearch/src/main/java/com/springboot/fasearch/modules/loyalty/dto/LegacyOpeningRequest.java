package com.springboot.fasearch.modules.loyalty.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LegacyOpeningRequest {
    @NotNull @Positive
    private Long customerId;
}
