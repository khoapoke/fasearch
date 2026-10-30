package com.springboot.fasearch.modules.search.dto.response;

import java.math.BigDecimal;

import com.springboot.fasearch.common.enums.ProductStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ProductSearchItemRes {

    private String id;
    private double score;
    private String imagePath;
    private String fullImageUrl;
    private String fileName;
    private String catalog;
    private Long productId;
    private String productName;
    private BigDecimal price;
    private ProductStatus status;
}

