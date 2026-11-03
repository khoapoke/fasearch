package com.springboot.fasearch.modules.publish.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import com.springboot.fasearch.modules.publish.entity.ProductDraft;

public interface ProductDraftRepository extends JpaRepository<ProductDraft, Long> {
    Optional<ProductDraft> findByProduct_IdAndDraftState(Long productId, String draftState);

    org.springframework.data.domain.Page<ProductDraft> findByProduct_IdOrderByUpdatedAtDesc(
            Long productId, org.springframework.data.domain.Pageable pageable);
    List<ProductDraft> findByDraftStateOrderByUpdatedAtDesc(String draftState);
    Page<ProductDraft> findByDraftState(String draftState, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ProductDraft d where d.id = :id")
    Optional<ProductDraft> findByIdForUpdate(@Param("id") Long id);
}
