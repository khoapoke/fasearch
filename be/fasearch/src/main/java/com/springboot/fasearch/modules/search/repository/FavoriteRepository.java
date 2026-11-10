package com.springboot.fasearch.modules.search.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.modules.search.entity.Favorite;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    Page<Favorite> findByAccount_IdAndIsDeletedFalseOrderByCreatedAtDesc(Long accountId, Pageable pageable);

    Optional<Favorite> findByAccount_IdAndProduct_IdAndIsDeletedFalse(Long accountId, Long productId);

    @Query("SELECT f FROM Favorite f WHERE f.account.id = :accountId AND f.product.id = :productId")
    Optional<Favorite> findAnyByAccountAndProduct(@Param("accountId") Long accountId, @Param("productId") Long productId);

    boolean existsByAccount_IdAndProduct_IdAndIsDeletedFalse(Long accountId, Long productId);

    @Modifying
    @Transactional
    @Query("UPDATE Favorite f SET f.isDeleted = true WHERE f.account.id = :accountId AND f.product.id = :productId AND f.isDeleted = false")
    int softDeleteByAccountAndProduct(@Param("accountId") Long accountId, @Param("productId") Long productId);

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO yeu_thich (ma_tk, ma_sp, ngay_tao, da_xoa) VALUES (:accountId, :productId, CURRENT_TIMESTAMP, false) ON CONFLICT (ma_tk, ma_sp) DO NOTHING", nativeQuery = true)
    int insertIgnoreConflict(@Param("accountId") Long accountId, @Param("productId") Long productId);
}