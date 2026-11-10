package com.springboot.fasearch.modules.khuyenmai.entity;

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
@Table(name = "ma_giam_gia")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaGiamGia {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_voucher")
    private Long id;

    @Column(name = "ma_km", nullable = false)
    private Long campaignId;

    @Column(name = "ma_code", nullable = false, length = 50)
    private String code;

    @Column(name = "so_luong_phat_hanh")
    private Integer issued;

    @Column(name = "da_su_dung", nullable = false)
    @Builder.Default
    private Integer used = 0;

    @Column(name = "so_luong_giu_cho", nullable = false)
    @Builder.Default
    private Integer held = 0;

    @Column(name = "trang_thai", nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean deleted = false;
}
