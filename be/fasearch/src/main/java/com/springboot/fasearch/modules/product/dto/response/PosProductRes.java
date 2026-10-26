package com.springboot.fasearch.modules.product.dto.response;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PosProductRes {

    private Long skuId;
    private Long productId;
    private String productName;
    private String color;
    private String size;
    private BigDecimal price;
    private String barcode;
    private Integer availableStock;
    private String imageUrl;
}
