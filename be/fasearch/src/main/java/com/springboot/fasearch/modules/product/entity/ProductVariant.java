package com.springboot.fasearch.modules.product.entity;

import java.math.BigDecimal;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.softdelete.SoftDeletable;
import com.springboot.fasearch.modules.auth.entity.Account;

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
@Table(name = "bien_the_sp")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ProductVariant implements SoftDeletable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_sku")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_sp", nullable = false)
    private Product product;

    @Column(name = "mau_sac", length = 50)
    private String color;

    @Column(name = "kich_co", length = 50)
    private String size;

    @Column(name = "ma_vach", length = 100, unique = true)
    private String barcode;

    /** Accent-insensitive text maintained by the database; read-only from the application. */
    @Column(name = "search_text", columnDefinition = "TEXT", insertable = false, updatable = false)
    private String searchText;

    @Column(name = "gia_phu_thu", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal additionalPrice = BigDecimal.ZERO;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    @Column(name = "ngay_xoa")
    private java.time.LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nguoi_xoa")
    private Account deletedBy;

    @Column(name = "ly_do_xoa", length = 255)
    private String deleteReason;
}
