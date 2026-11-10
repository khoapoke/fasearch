package com.springboot.fasearch.modules.user.entity;

import java.time.LocalDate;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.Gender;
import com.springboot.fasearch.common.softdelete.SoftDeletable;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "nhan_vien")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Employee implements SoftDeletable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_nv")
    private Long id;

    @Column(name = "ho_nv", length = 50)
    private String firstName;

    @Column(name = "ten_nv", length = 50, nullable = false)
    private String lastName;

    @Column(name = "hinh_anh_nv", length = 255)
    private String avatar;

    @Enumerated(EnumType.STRING)
    @Column(name = "gioi_tinh", length = 10)
    private Gender gender;

    @Column(name = "ngay_sinh")
    private LocalDate dob;

    @Column(name = "sdt", length = 15, unique = true)
    private String phoneNumber;

    @Column(name = "cccd", length = 20, unique = true)
    private String cccd;

    @Column(name = "dia_chi", columnDefinition = "TEXT")
    private String address;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_tk")
    private Account account;

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
}
