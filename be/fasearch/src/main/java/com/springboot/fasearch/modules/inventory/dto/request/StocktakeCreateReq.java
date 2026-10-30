package com.springboot.fasearch.modules.inventory.dto.request;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
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
public class StocktakeCreateReq {

    private String note;

    @NotEmpty(message = "Danh sách bản ghi kiểm kê không được để trống")
    @Valid
    private List<StocktakeItemReq> records;
}
