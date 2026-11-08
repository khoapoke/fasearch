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

    /** Bản nháp đang mở kèm danh mục/thương hiệu để kiểm tra trùng khi nhập CSV. */
    @Query("select d from ProductDraft d left join fetch d.category left join fetch d.brand "
            + "where d.draftState = :state")
    List<ProductDraft> findOpenWithCatalog(@Param("state") String state);

    /**
     * Khóa cấp giao dịch cho lần nhập CSV: hai lần nhập đồng thời được xếp hàng, lần thứ hai
     * kiểm tra lại và thấy bản nháp do lần đầu tạo nên không thể nhân đôi.
     */
    @Query(value = "select pg_advisory_xact_lock(hashtext('fasearch_csv_product_import')) is null",
            nativeQuery = true)
    boolean lockProductImport();
}
