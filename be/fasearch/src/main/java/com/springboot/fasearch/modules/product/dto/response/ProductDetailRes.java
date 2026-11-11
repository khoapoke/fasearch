package com.springboot.fasearch.modules.product.dto.response;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;

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
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductDetailRes {

    private Long id;
    private String productName;
    private Long categoryId;
    private String categoryName;
    private String material;
    private String style;
    private String description;
    private BigDecimal price;
    private String imageUrl;
    private ProductStatus status;
    private PublicationStatus publicationStatus;
    private Long brandId;
    private String brandName;
    private String brandSlug;
    private String brandLogoUrl;
    private String modelCode;
    private List<VariantRes> variants;

    private String sourceHost;
    private String sourceUrl;
    private String sourceBrand;
    private java.math.BigDecimal sourcePrice;
    private String sourceCurrency;
    private String curationClass;
}
