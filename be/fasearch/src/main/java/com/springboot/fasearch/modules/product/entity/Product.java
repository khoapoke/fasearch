package com.springboot.fasearch.modules.product.entity;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.common.softdelete.SoftDeletable;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;
import com.springboot.fasearch.modules.brand.entity.Brand;

import jakarta.persistence.CascadeType;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "san_pham")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Product implements SoftDeletable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_sp")
    private Long id;

    @Column(name = "ten_sp", length = 255, nullable = false)
    private String productName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_danh_muc")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_thuong_hieu")
    private Brand brand;

    @Column(name = "model_code", length = 100)
    private String modelCode;

    /** Accent-insensitive text maintained by the database; read-only from the application. */
    @Column(name = "search_text", columnDefinition = "TEXT", insertable = false, updatable = false)
    private String searchText;

    @Column(name = "chat_lieu", length = 100)
    private String material;

    @Column(name = "kieu_dang", length = 100)
    private String style;

    @Column(name = "mo_ta", columnDefinition = "TEXT")
    private String description;

    @Column(name = "gia_ban", precision = 15, scale = 2, nullable = false)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(name = "trang_thai", length = 50)
    @Builder.Default
    private ProductStatus status = ProductStatus.ACTIVE;

    @Column(name = "hinh_anh_sp", length = 255)
    private String imageUrl;

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

    @Enumerated(EnumType.STRING)
    @Column(name = "publication_status", length = 20, nullable = false)
    @Builder.Default
    private PublicationStatus publicationStatus = PublicationStatus.PUBLISHED;

    @Column(name = "publication_version", nullable = false)
    @Builder.Default
    private Long publicationVersion = 1L;

    // Source attribution snapshot; populated only by the guarded candidate import.
    @Column(name = "source_host", length = 150)
    private String sourceHost;

    @Column(name = "source_product_id", length = 100)
    private String sourceProductId;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "source_payload_sha256", length = 64)
    private String sourcePayloadSha256;

    @Column(name = "source_fetched_at")
    private java.time.LocalDateTime sourceFetchedAt;

    @Column(name = "source_price", precision = 15, scale = 2)
    private java.math.BigDecimal sourcePrice;

    @Column(name = "source_currency", length = 10)
    private String sourceCurrency;

    @Column(name = "source_brand", length = 150)
    private String sourceBrand;

    @Column(name = "curation_class", length = 30)
    private String curationClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_ref_id")
    private Product publishedRef;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductVariant> variants = new ArrayList<>();
}
