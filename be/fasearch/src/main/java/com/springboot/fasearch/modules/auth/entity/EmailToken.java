package com.springboot.fasearch.modules.auth.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.springboot.fasearch.common.enums.EmailTokenPurpose;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Token dung mot lan cho xac thuc email / dat lai mat khau.
 * Chi luu SHA-256 hash, khong bao gio luu token tho.
 */
@Entity
@Table(name = "email_token", indexes = {
        @Index(name = "ix_email_token_account", columnList = "ma_tk, muc_dich")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class EmailToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ma_token")
    private Long id;

    @Column(name = "token_hash", length = 64, nullable = false, unique = true)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "muc_dich", length = 20, nullable = false)
    private EmailTokenPurpose purpose;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ma_tk", nullable = false)
    private Account account;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "het_han", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "da_dung")
    private LocalDateTime usedAt;

    @CreationTimestamp
    @Column(name = "ngay_tao", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "ip_yeu_cau", length = 64)
    private String requestIp;
}
