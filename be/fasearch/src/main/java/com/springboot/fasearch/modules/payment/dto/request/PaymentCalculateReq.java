package com.springboot.fasearch.modules.payment.dto.request;

import jakarta.validation.constraints.Min;
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
public class PaymentCalculateReq {

    @NotNull(message = "Mã đơn hàng không được để trống")
    private Long orderId;

    private String voucherCode;

    @Min(value = 0, message = "Điểm quy đổi phải lớn hơn hoặc bằng 0")
    private Integer redeemedPoints;
}
