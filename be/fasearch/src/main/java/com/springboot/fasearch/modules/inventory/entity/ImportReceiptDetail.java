package com.springboot.fasearch.modules.inventory.entity;

import java.math.BigDecimal;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.modules.product.entity.ProductVariant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "ct_phieu_nhap")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ImportReceiptDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_ct_nhap")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_phieu_nhap", nullable = false)
    private ImportReceipt receipt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_sku", nullable = false)
    private ProductVariant variant;

    @Column(name = "so_luong", nullable = false)
    private Integer quantity;

    @Column(name = "gia_nhap", nullable = false, precision = 15, scale = 2)
    private BigDecimal importPrice;

    @Column(name = "thanh_tien", nullable = false, precision = 15, scale = 2)
    private BigDecimal subTotal;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
}
