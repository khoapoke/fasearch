package com.springboot.fasearch.modules.order.dto.response;

import java.math.BigDecimal;
import java.util.List;

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
public class CartRes {

    private Long cartId;
    private Integer totalItems;
    private BigDecimal subTotal;
    private List<CartItemRes> items;
}
