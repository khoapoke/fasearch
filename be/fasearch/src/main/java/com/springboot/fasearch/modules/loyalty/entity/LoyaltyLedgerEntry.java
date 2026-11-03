package com.springboot.fasearch.modules.loyalty.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.springboot.fasearch.modules.user.entity.Customer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "loyalty_ledger_entry")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoyaltyLedgerEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "entry_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 10)
    private LoyaltyEntryType type;

    @Column(nullable = false)
    private Integer points;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "source_key", nullable = false, length = 64)
    private String sourceKey;

    @CreationTimestamp
    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;
}
