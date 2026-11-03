package com.springboot.fasearch.modules.brand.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLRestriction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "thuong_hieu")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Brand {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_thuong_hieu")
    private Long id;

    @Column(name = "ten_thuong_hieu", length = 150, nullable = false)
    private String name;

    @Column(name = "slug", length = 100, nullable = false, unique = true)
    private String slug;

    @Column(name = "quoc_gia", length = 100)
    private String country;

    @Column(name = "logo_file_name", length = 255)
    private String logoFileName;

    @Column(name = "official_url", columnDefinition = "TEXT")
    private String officialUrl;

    @Column(name = "provenance_url", columnDefinition = "TEXT")
    private String provenanceUrl;

    @Column(name = "provenance_sha256", length = 64)
    private String provenanceSha256;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    @CreationTimestamp
    @Column(name = "ngay_tao", updatable = false)
    private LocalDateTime createdAt;
}
