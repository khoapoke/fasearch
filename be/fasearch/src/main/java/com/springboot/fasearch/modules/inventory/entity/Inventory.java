package com.springboot.fasearch.modules.inventory.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.modules.product.entity.ProductVariant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ton_kho")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_ton_kho")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_sku", nullable = false, unique = true)
    private ProductVariant variant;

    @Column(name = "so_luong_vat_ly", nullable = false)
    @Builder.Default
    private Integer physicalStock = 0;

    @Column(name = "so_luong_tam_giu", nullable = false)
    @Builder.Default
    private Integer reservedStock = 0;

    @Column(name = "so_luong_kha_dung", nullable = false)
    @Builder.Default
    private Integer availableStock = 0;

    @Column(name = "nguong_toi_thieu", nullable = false)
    @Builder.Default
    private Integer minThreshold = 10;

    @CreationTimestamp
    @Column(name = "ngay_cap_nhat")
    private LocalDateTime updatedAt;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
}
