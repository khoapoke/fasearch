package com.springboot.fasearch.modules.inventory.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.ReceiptStatus;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "phieu_nhap_kho")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ImportReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_phieu_nhap")
    private Long id;

    @Column(name = "ma_phieu", nullable = false, unique = true, length = 50)
    private String receiptCode;

    @Column(name = "nha_cung_cap", length = 255)
    private String supplierName;

    @Column(name = "ghi_chu", columnDefinition = "TEXT")
    private String note;

    @Column(name = "tong_so_luong", nullable = false)
    @Builder.Default
    private Integer totalQuantity = 0;

    @Column(name = "tong_tien", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "trang_thai", nullable = false, length = 50)
    @Builder.Default
    private ReceiptStatus status = ReceiptStatus.COMPLETED;

    @CreationTimestamp
    @Column(name = "ngay_tao")
    private LocalDateTime createdAt;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    @OneToMany(mappedBy = "receipt", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ImportReceiptDetail> details = new ArrayList<>();
}
