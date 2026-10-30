package com.springboot.fasearch.modules.inventory.dto.response;

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
public class ImportReceiptItemRes {

    private Long id;
    private Long skuId;
    private String productName;
    private String color;
    private String size;
    private String barcode;
    private Integer quantity;
    private BigDecimal importPrice;
    private BigDecimal subTotal;
}
