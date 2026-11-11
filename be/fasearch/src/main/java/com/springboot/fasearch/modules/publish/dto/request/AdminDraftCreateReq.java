package com.springboot.fasearch.modules.publish.dto.request;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminDraftCreateReq {
    private Long productId;

    @Size(max = 255)
    private String productName;

    private Long categoryId;
    private Long brandId;

    @Size(max = 100)
    private String modelCode;

    @Size(max = 100)
    private String material;

    @Size(max = 100)
    private String style;

    private String description;

    @DecimalMin(value = "0.0")
    private BigDecimal price;

    private String imageUrl;

    @Size(max = 50)
    private String sourceKind;

    private String sourceUrl;

    @Size(max = 64)
    private String sourceHash;

    @Valid
    private List<AdminDraftVariantReq> variants;
}
