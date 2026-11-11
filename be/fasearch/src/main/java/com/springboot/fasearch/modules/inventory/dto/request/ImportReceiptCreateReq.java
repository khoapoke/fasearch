package com.springboot.fasearch.modules.inventory.dto.request;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
public class ImportReceiptCreateReq {

    @NotBlank(message = "Tên nhà cung cấp không được để trống")
    @Size(max = 255, message = "Tên nhà cung cấp tối đa 255 ký tự")
    private String supplierName;

    private String note;

    @NotEmpty(message = "Danh sách mặt hàng nhập không được để trống")
    @Valid
    private List<ImportReceiptItemReq> items;
}
