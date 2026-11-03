package com.springboot.fasearch.modules.search.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.product.entity.Product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "yeu_thich")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_yt")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_tk", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_sp", nullable = false)
    private Product product;

    @Column(name = "ngay_tao", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
}