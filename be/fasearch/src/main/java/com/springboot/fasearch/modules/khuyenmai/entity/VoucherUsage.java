package com.springboot.fasearch.modules.khuyenmai.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "su_dung_voucher")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoucherUsage {
    @Id
    @Column(name = "ma_don_hang")
    private Long orderId;

    @Column(name = "ma_voucher", nullable = false)
    private Long voucherId;

    @Column(name = "tien_giam", nullable = false, precision = 15, scale = 2)
    private BigDecimal discount;

    @Column(name = "trang_thai", nullable = false)
    private String status;

    @CreationTimestamp
    @Column(name = "ngay_tao", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "ngay_cap_nhat")
    private LocalDateTime updatedAt;
}
