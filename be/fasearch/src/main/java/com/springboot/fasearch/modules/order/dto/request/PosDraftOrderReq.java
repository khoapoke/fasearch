package com.springboot.fasearch.modules.order.dto.request;

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
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PosDraftOrderReq {

    private String customerPhone;

    private String note;

    @NotEmpty(message = "Danh sách sản phẩm trong đơn tạm không được để trống")
    @Valid
    private List<PosDraftItemReq> items;
}
