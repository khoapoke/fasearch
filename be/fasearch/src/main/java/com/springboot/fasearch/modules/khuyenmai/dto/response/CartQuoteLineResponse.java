package com.springboot.fasearch.modules.khuyenmai.dto.response;

import java.math.BigDecimal;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CartQuoteLineResponse {
    private Long skuId;
    private String productName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalPrice;
    private BigDecimal discountAmount;
}
