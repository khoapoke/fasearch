package com.springboot.fasearch.modules.khuyenmai.dto.response;

import java.math.BigDecimal;
import java.util.List;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CartQuoteResponse {
    private List<CartQuoteLineResponse> items;
    private BigDecimal subTotal;
    private String voucherCode;
    private BigDecimal voucherDiscount;
    private BigDecimal merchandiseAmountDue;
    private String quoteFingerprint;
}
