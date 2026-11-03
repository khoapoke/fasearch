package com.springboot.fasearch.modules.publish.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.publish.entity.AiSyncStatus;
import com.springboot.fasearch.modules.publish.entity.ProductAiSync;

import jakarta.persistence.LockModeType;

public interface ProductAiSyncRepository extends JpaRepository<ProductAiSync, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ProductAiSync s where s.productId = :productId")
    Optional<ProductAiSync> findByIdForUpdate(@Param("productId") Long productId);

    List<ProductAiSync> findByStatus(AiSyncStatus status);

    List<ProductAiSync> findTop20ByStatusOrderByUpdatedAtAsc(AiSyncStatus status);
}
