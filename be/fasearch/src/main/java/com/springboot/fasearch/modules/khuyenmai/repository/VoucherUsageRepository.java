package com.springboot.fasearch.modules.khuyenmai.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.khuyenmai.entity.VoucherUsage;

import jakarta.persistence.LockModeType;

public interface VoucherUsageRepository extends JpaRepository<VoucherUsage, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from VoucherUsage u where u.orderId = :orderId")
    Optional<VoucherUsage> findByOrderIdForUpdate(@Param("orderId") Long orderId);
}
