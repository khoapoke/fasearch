package com.springboot.fasearch.modules.order.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.Employee;

import jakarta.persistence.CascadeType;
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
@Table(name = "don_hang")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_don_hang")
    private Long id;

    @Column(name = "ma_don", unique = true, length = 50)
    private String orderCode;

    /** Accent-insensitive text maintained by the database; read-only from the application. */
    @Column(name = "search_text", columnDefinition = "TEXT", insertable = false, updatable = false)
    private String searchText;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_kh")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_nv")
    private Employee employee;

    @CreationTimestamp
    @Column(name = "ngay_dat")
    private LocalDateTime orderDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "trang_thai", length = 50)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    @Column(name = "dia_chi_giao", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(name = "phi_van_chuyen", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(name = "ma_voucher")
    private Long voucherId;

    @Column(name = "ma_code_voucher", length = 50)
    private String voucherCode;

    @Column(name = "ten_ctkm_snapshot", length = 255)
    private String voucherCampaignName;

    @Column(name = "phien_ban_km")
    private Long voucherCampaignVersion;

    @Column(name = "loai_giam_snapshot", length = 50)
    private String voucherDiscountType;

    @Column(name = "gia_tri_giam_snapshot", precision = 15, scale = 2)
    private BigDecimal voucherDiscountValue;

    @Column(name = "tien_giam", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "redeemed_points", nullable = false)
    @Builder.Default
    private Integer redeemedPoints = 0;

    @Column(name = "points_discount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal pointsDiscount = BigDecimal.ZERO;

    @Column(name = "loyalty_policy_id")
    private Long loyaltyPolicyId;

    @Column(name = "loyalty_policy_version")
    private Long loyaltyPolicyVersion;

    @Column(name = "redeem_currency_per_point_snapshot", precision = 19, scale = 2)
    private BigDecimal redeemCurrencyPerPointSnapshot;

    @Column(name = "earned_points")
    private Integer earnedPoints;

    @Column(name = "loyalty_quote_fingerprint", length = 64)
    private String loyaltyQuoteFingerprint;

    @Column(name = "tong_tien", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "ghi_chu", columnDefinition = "TEXT")
    private String note;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderDetail> details = new ArrayList<>();
    @Column(name = "delivery_latitude")
    private Double deliveryLatitude;
    @Column(name = "delivery_longitude")
    private Double deliveryLongitude;
    @Column(name = "distance_km")
    private Double distanceKm;
    @Column(name = "shipping_method")
    private String shippingMethod;

}
