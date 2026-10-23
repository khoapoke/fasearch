package com.springboot.fasearch.modules.user.entity;

import java.time.LocalDate;

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
@Table (name = "khach_hang")
@Getter 
@Setter 
@AllArgsConstructor 
@NoArgsConstructor 
@Builder 
public class User {
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_kh")
    private Long maKh;

    @Column(name = "ho_kh", length = 50)
    private String hoKh;

    @Column(name = "ten_kh", length = 50, nullable = false)
    private String tenKh;

    @Column(name = "sdt", length = 15, unique = true)
    private String sdt;

    // @Column(name = "email", length = 100, unique = true) // Cột email từ bảng tai_khoan mang qua hoặc thêm vào bảng này
    // private String email;

    @Column(name = "ngay_sinh")
    private LocalDate ngaySinh;

    @Column(name = "diem_tich_luy")
    private Integer diemTichLuy;
}
