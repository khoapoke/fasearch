package com.springboot.fasearch.modules.inventory.dto.request;

import jakarta.validation.constraints.Min;
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
public class ExportReceiptItemReq {

    @NotNull(message = "Mã SKU không được để trống")
    private Long skuId;

    @NotNull(message = "Số lượng xuất không được để trống")
    @Min(value = 1, message = "Số lượng xuất phải lớn hơn 0")
    private Integer quantity;

    @Size(max = 255, message = "Lý do tối đa 255 ký tự")
    private String reason;
}
