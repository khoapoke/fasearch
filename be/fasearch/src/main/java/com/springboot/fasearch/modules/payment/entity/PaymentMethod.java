package com.springboot.fasearch.modules.payment.entity;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.PaymentMethodType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "phuong_thuc_thanh_toan")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class PaymentMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_phuong_thuc_tt")
    private Long id;

    @Column(name = "ten_phuong_thuc_tt", length = 100, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "loai_phuong_thuc_tt", length = 50)
    private PaymentMethodType type;

    @Column(name = "trang_thai", length = 50)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "ghi_chu", columnDefinition = "TEXT")
    private String note;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
}
