package com.springboot.fasearch.modules.khuyenmai.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "khuyen_mai")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KhuyenMai {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_km")
    private Long id;

    @Column(name = "ten_ctkm", nullable = false)
    private String name;

    @Column(name = "loai_giam", nullable = false)
    private String discountType;

    @Column(name = "gia_tri_giam", nullable = false, precision = 15, scale = 2)
    private BigDecimal discountValue;

    @Column(name = "ngay_bat_dau", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "ngay_ket_thuc", nullable = false)
    private LocalDateTime endAt;

    @Column(name = "dieu_kien_ap_dung")
    private String conditionText;

    @Column(name = "trang_thai", nullable = false)
    private String status;

    @Column(name = "phien_ban", nullable = false)
    private Long version;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "khuyen_mai_san_pham", joinColumns = @JoinColumn(name = "ma_km"))
    @Column(name = "ma_sp")
    @Builder.Default
    private Set<Long> productScope = new HashSet<>();
}
