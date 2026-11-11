package com.springboot.fasearch.modules.order.entity;

import java.io.Serializable;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CheckoutIdempotencyId implements Serializable {
    @Column(name = "ma_kh")
    private Long customerId;

    @Column(name = "checkout_key", length = 100)
    private String checkoutKey;
}
