package com.springboot.fasearch.modules.user.entity;

import java.time.LocalDate;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.Gender;
import com.springboot.fasearch.modules.auth.entity.Account;

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
@Table(name = "khach_hang")
@SQLRestriction("da_xoa = false")
@Getter 
@Setter 
@AllArgsConstructor 
@NoArgsConstructor 
@Builder 
public class Customer { 

    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_kh")
    private Long id;

    @Column(name = "ho_kh", length = 50)
    private String firstName;

    @Column(name = "ten_kh", length = 50, nullable = false)
    private String lastName;

    @Column(name = "hinh_anh_kh", length = 255)
    private String avatar;

    @Enumerated(EnumType.STRING)
    @Column(name = "gioi_tinh", length = 10)
    private Gender gender;

    @Column(name = "sdt", length = 15, unique = true)
    private String phoneNumber;

    @Column(name = "ngay_sinh")
    private LocalDate dob;

    @Column(name = "dia_chi", columnDefinition = "TEXT")
    private String address;

    @Column(name = "diem_tich_luy")
    @Builder.Default
    private Integer accumulatePoint = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_hang")
    private MembershipTier membershipTier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_tk")
    private Account account;

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
}
