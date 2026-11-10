package com.springboot.fasearch.modules.publish.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import com.springboot.fasearch.modules.publish.entity.ProductDraftVariant;

public interface ProductDraftVariantRepository extends JpaRepository<ProductDraftVariant, Long> {
    List<ProductDraftVariant> findByDraft_Id(Long draftId);

    /** Mọi biến thể của các bản nháp đang mở, dùng để chặn trùng mã vạch khi nhập CSV. */
    List<ProductDraftVariant> findByDraft_DraftState(String draftState);
    @Modifying
    void deleteByDraft_Id(Long draftId);
}
