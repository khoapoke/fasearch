package com.springboot.fasearch.modules.inventory.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
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
public class StocktakeItemReq {

    @NotNull(message = "Mã SKU không được để trống")
    private Long skuId;

    @NotNull(message = "Số lượng đếm thực tế không được để trống")
    @Min(value = 0, message = "Số lượng đếm thực tế phải >= 0")
    private Integer actualCount;
}
