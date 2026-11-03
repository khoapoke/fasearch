package com.springboot.fasearch.modules.publish.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;

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
@Table(name = "product_draft")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ProductDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_ban_nhap")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_sp")
    private Product product;

    @Column(name = "ten_sp", length = 255)
    private String productName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_danh_muc")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_thuong_hieu")
    private Brand brand;

    @Column(name = "model_code", length = 100)
    private String modelCode;

    @Column(name = "chat_lieu", length = 100)
    private String material;

    @Column(name = "kieu_dang", length = 100)
    private String style;

    @Column(name = "mo_ta", columnDefinition = "TEXT")
    private String description;

    @Column(name = "gia_ban", precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "hinh_anh_sp", length = 255)
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "trang_thai", length = 50)
    private ProductStatus status;

    @Column(name = "phien_ban", nullable = false)
    @Builder.Default
    private Long version = 1L;

    @Column(name = "trang_thai_ban_nhap", length = 20, nullable = false)
    @Builder.Default
    private String draftState = "DRAFT";

    @Column(name = "nguon_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "nguon_hash", length = 64)
    private String sourceHash;

    @Column(name = "nguon_loai", length = 30)
    private String sourceKind;

    @CreationTimestamp
    @Column(name = "ngay_tao", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "ngay_cap_nhat")
    private LocalDateTime updatedAt;
}
