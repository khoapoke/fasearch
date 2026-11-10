package com.springboot.fasearch.modules.khuyenmai.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.khuyenmai.entity.KhuyenMai;

import jakarta.persistence.LockModeType;

public interface KhuyenMaiRepository extends JpaRepository<KhuyenMai, Long>, JpaSpecificationExecutor<KhuyenMai> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select k from KhuyenMai k where k.id = :id")
    Optional<KhuyenMai> findByIdForUpdate(@Param("id") Long id);

    @Query("select k from KhuyenMai k where k.status = 'HOAT_DONG' and k.deleted = false "
            + "and k.startAt <= :now and k.endAt >= :now order by k.endAt asc, k.id asc")
    List<KhuyenMai> findPublicActive(@Param("now") LocalDateTime now);
}
