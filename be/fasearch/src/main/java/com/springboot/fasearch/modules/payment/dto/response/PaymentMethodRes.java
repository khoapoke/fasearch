package com.springboot.fasearch.modules.payment.dto.response;

import com.springboot.fasearch.common.enums.PaymentMethodType;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class PaymentMethodRes {

    private Long id;
    private PaymentMethodType methodCode;
    private String methodName;
    private String status;
    private String note;
}
