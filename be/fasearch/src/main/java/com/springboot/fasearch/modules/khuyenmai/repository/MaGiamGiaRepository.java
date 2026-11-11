package com.springboot.fasearch.modules.khuyenmai.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.khuyenmai.entity.MaGiamGia;

import jakarta.persistence.LockModeType;

public interface MaGiamGiaRepository extends JpaRepository<MaGiamGia, Long> {
    java.util.List<MaGiamGia> findByCampaignIdOrderByIdAsc(Long campaignId);

    @Query("select v from MaGiamGia v where upper(v.code) = upper(:code) and v.deleted = false")
    Optional<MaGiamGia> findByCodeIgnoreCase(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from MaGiamGia v where upper(v.code) = upper(:code) and v.deleted = false")
    Optional<MaGiamGia> findByCodeForUpdate(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from MaGiamGia v where v.id = :id and v.deleted = false")
    Optional<MaGiamGia> findByIdForUpdate(@Param("id") Long id);
}
