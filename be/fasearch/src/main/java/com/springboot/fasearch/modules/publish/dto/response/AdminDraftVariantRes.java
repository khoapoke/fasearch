package com.springboot.fasearch.modules.publish.dto.response;

import java.math.BigDecimal;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminDraftVariantRes {
    private String color;
    private String size;
    private String barcode;
    private BigDecimal additionalPrice;
    private Integer stock;
}
