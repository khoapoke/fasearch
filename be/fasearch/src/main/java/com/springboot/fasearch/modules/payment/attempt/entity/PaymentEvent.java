package com.springboot.fasearch.modules.payment.attempt.entity;

import java.time.LocalDateTime;

import com.springboot.fasearch.modules.order.entity.Order;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "payment_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_payment_event")
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", length = 30, nullable = false)
    private PaymentProvider provider;

    @Column(name = "provider_event_id", length = 255, nullable = false)
    private String providerEventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_payment_attempt")
    private PaymentAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_don_hang")
    private Order order;

    @Column(name = "payload_sha256", length = 64, nullable = false)
    private String payloadSha256;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private PaymentEventStatus status;

    @Column(name = "received_at", nullable = false, updatable = false)
    private LocalDateTime receivedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "error_code", length = 100)
    private String errorCode;
}
