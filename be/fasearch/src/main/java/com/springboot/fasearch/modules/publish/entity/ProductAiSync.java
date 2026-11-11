package com.springboot.fasearch.modules.publish.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "product_ai_sync")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ProductAiSync {

    @Id
    @Column(name = "ma_sp")
    private Long productId;

    @Column(name = "phien_ban", nullable = false)
    private Long version;

    @Enumerated(EnumType.STRING)
    @Column(name = "trang_thai", length = 20, nullable = false)
    @Builder.Default
    private AiSyncStatus status = AiSyncStatus.PENDING;

    @Column(name = "so_lan_thu", nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    @UpdateTimestamp
    @Column(name = "lan_cap_nhat_cuoi")
    private LocalDateTime updatedAt;

    @Column(name = "loi_cuoi", columnDefinition = "TEXT")
    private String lastError;
}
