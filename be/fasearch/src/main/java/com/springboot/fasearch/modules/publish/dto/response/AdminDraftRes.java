package com.springboot.fasearch.modules.publish.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.springboot.fasearch.common.enums.ProductStatus;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminDraftRes {
    private Long draftId;
    private Long productId;
    private Long version;
    private String draftState;
    private String productName;
    private Long categoryId;
    private String categoryName;
    private Long brandId;
    private String brandName;
    private String brandSlug;
    private String modelCode;
    private String material;
    private String style;
    private String description;
    private BigDecimal price;
    private String imageUrl;
    private ProductStatus status;
    private List<AdminDraftVariantRes> variants;
    private String sourceUrl;
    private String sourceHash;
    private String sourceKind;
    private LocalDateTime updatedAt;
}
