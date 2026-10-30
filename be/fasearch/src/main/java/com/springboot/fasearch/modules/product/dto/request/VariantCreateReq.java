package com.springboot.fasearch.modules.product.dto.request;

import jakarta.validation.constraints.NotBlank;
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
public class VariantCreateReq {

    @NotBlank(message = "Màu sắc không được để trống")
    @Size(max = 50, message = "Màu sắc tối đa 50 ký tự")
    private String color;

    @NotBlank(message = "Kích cỡ không được để trống")
    @Size(max = 50, message = "Kích cỡ tối đa 50 ký tự")
    private String size;

    @Size(max = 100, message = "Mã vạch tối đa 100 ký tự")
    private String barcode;
}
