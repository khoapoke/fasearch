package com.springboot.fasearch.modules.inventory.dto.response;

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
public class StockRes {

    private Long skuId;
    private Long productId;
    private String productName;
    private String color;
    private String size;
    private String barcode;
    private Integer physicalStock;
    private Integer reservedStock;
    private Integer availableStock;
    private Integer minThreshold;
}
