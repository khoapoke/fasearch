package com.springboot.fasearch.modules.khuyenmai.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CartQuoteRequest {
    @Size(max = 50) private String voucherCode;
}
