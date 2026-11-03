package com.springboot.fasearch.modules.order.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "checkout_idempotency")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckoutIdempotency {
    @EmbeddedId
    private CheckoutIdempotencyId id;

    @Column(name = "payload_hash", nullable = false, length = 64)
    private String payloadHash;

    @Column(name = "ma_don_hang", nullable = false, unique = true)
    private Long orderId;

    @Column(name = "ngay_tao", nullable = false)
    private LocalDateTime createdAt;
}
