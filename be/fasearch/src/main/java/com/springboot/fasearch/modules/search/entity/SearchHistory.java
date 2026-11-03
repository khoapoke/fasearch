package com.springboot.fasearch.modules.search.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.SQLRestriction;

import com.springboot.fasearch.common.enums.SearchMode;
import com.springboot.fasearch.common.enums.SearchStatus;
import com.springboot.fasearch.modules.auth.entity.Account;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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
@Table(name = "lich_su_tim_kiem")
@SQLRestriction("da_xoa = false")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SearchHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_ls")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_tk", nullable = false)
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(name = "che_do", length = 20, nullable = false)
    private SearchMode mode;

    @Column(name = "truy_van", length = 500)
    private String query;

    @Column(name = "so_ket_qua", nullable = false)
    @Builder.Default
    private Integer resultCount = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "refs_ket_qua", columnDefinition = "jsonb")
    private String resultRefs;

    @Enumerated(EnumType.STRING)
    @Column(name = "trang_thai", length = 20, nullable = false)
    private SearchStatus status;

    @Column(name = "thoi_gian", nullable = false)
    @Builder.Default
    private LocalDateTime occurredAt = LocalDateTime.now();

    @Column(name = "da_xoa", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
}