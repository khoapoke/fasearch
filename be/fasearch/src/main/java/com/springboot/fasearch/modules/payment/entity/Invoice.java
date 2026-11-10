package com.springboot.fasearch.modules.payment.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.user.entity.Employee;

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
@Table(name = "hoa_don")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_hoa_don")
    private Long id;

    @Column(name = "ma_hd", unique = true, length = 50)
    private String invoiceCode;

    @CreationTimestamp
    @Column(name = "ngay_lap")
    private LocalDateTime issuedAt;

    @Column(name = "thue_vat", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal vatAmount = BigDecimal.ZERO;

    @Column(name = "tong_tien_thuc_tra", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalActualPaid = BigDecimal.ZERO;

    @Column(name = "tien_khach_dua", precision = 15, scale = 2)
    private BigDecimal cashReceived;

    @Column(name = "tien_thua", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal cashChange = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method_code", length = 30)
    private PaymentMethodType paymentMethodCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "trang_thai", length = 50)
    @Builder.Default
    private PaymentStatus status = PaymentStatus.PENDING;

    @Column(name = "ghi_chu", columnDefinition = "TEXT")
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_don_hang")
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_nv")
    private Employee employee;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
}
