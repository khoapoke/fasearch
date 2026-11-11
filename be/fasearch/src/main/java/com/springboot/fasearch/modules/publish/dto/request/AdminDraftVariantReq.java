package com.springboot.fasearch.modules.publish.dto.request;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminDraftVariantReq {
    @Size(max = 50)
    private String color;

    @Size(max = 50)
    private String size;

    @Size(max = 100)
    private String barcode;

    @DecimalMin(value = "0.0")
    private BigDecimal additionalPrice;

    @Min(0)
    private Integer stock;
}
