package com.springboot.fasearch.modules.product.dto.request;

import java.math.BigDecimal;
import java.util.List;

import com.springboot.fasearch.common.enums.ProductStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
public class ProductCreateReq {

    @NotBlank(message = "Tên sản phẩm không được để trống")
    @Size(max = 255, message = "Tên sản phẩm tối đa 255 ký tự")
    private String productName;

    @NotNull(message = "Danh mục không được để trống")
    private Long categoryId;

    @Size(max = 100, message = "Chất liệu tối đa 100 ký tự")
    private String material;

    @Size(max = 100, message = "Kiểu dáng tối đa 100 ký tự")
    private String style;

    private String description;

    @NotNull(message = "Giá bán không được để trống")
    @DecimalMin(value = "0.0", message = "Giá bán không được âm")
    private BigDecimal price;

    private String imageUrl;

    @Builder.Default
    private ProductStatus status = ProductStatus.ACTIVE;

    @Valid
    private List<VariantReq> variants;
}
