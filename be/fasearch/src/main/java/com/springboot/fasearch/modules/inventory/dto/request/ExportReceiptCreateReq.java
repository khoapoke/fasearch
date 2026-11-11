package com.springboot.fasearch.modules.inventory.dto.request;

import java.util.List;

import com.springboot.fasearch.common.enums.ExportType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
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
public class ExportReceiptCreateReq {

    @NotNull(message = "Loại xuất kho không được để trống")
    private ExportType exportType;

    private String note;

    @NotEmpty(message = "Danh sách mặt hàng xuất không được để trống")
    @Valid
    private List<ExportReceiptItemReq> items;
}
