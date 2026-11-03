package com.springboot.fasearch.modules.payment.attempt.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.springboot.fasearch.modules.order.entity.Order;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "payment_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_payment_attempt")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_don_hang", nullable = false)
    private Order order;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", length = 30, nullable = false)
    private PaymentProvider provider;

    @Column(name = "provider_session_id", length = 255)
    private String providerSessionId;

    @Column(name = "provider_reference", length = 255)
    private String providerReference;

    @Column(name = "provider_checkout_url", length = 1000)
    private String providerCheckoutUrl;

    @Column(name = "amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private PaymentAttemptStatus status;

    @Column(name = "idempotency_key", length = 100, nullable = false)
    private String idempotencyKey;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
