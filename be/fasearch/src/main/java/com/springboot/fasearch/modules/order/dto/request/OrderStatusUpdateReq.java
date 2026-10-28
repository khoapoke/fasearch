package com.springboot.fasearch.modules.order.dto.request;

import com.springboot.fasearch.common.enums.OrderStatus;

import jakarta.validation.constraints.NotNull;
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
public class OrderStatusUpdateReq {

    @NotNull(message = "Trạng thái đơn hàng không được để trống")
    private OrderStatus status;

    private String note;
}
