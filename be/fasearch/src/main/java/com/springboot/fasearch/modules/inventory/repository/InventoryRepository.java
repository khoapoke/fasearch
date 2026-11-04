package com.springboot.fasearch.modules.inventory.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.modules.inventory.entity.Inventory;

import jakarta.persistence.LockModeType;

public interface InventoryRepository extends JpaRepository<Inventory, Long>, JpaSpecificationExecutor<Inventory> {

    Optional<Inventory> findByVariantId(Long skuId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inventory i where i.variant.id = :skuId")
    Optional<Inventory> findByVariantIdForUpdate(@Param("skuId") Long skuId);

    boolean existsByVariantId(Long skuId);

    /*
     * Overview aggregates. Every count is evaluated by the database over all live stock rows so the
     * Overview never infers global numbers from a page of results. "Available" is the persisted
     * so_luong_kha_dung column (physical - reserved), not a recomputation.
     */
    @Query("select count(i) from Inventory i where i.isDeleted = false")
    long countLive();

    @Query("select count(i) from Inventory i where i.isDeleted = false and i.availableStock <= 0")
    long countOutOfStock();

    @Query("select count(i) from Inventory i where i.isDeleted = false and i.availableStock > 0 "
            + "and i.availableStock <= i.minThreshold")
    long countLowStock();

    @Query("select count(i) from Inventory i where i.isDeleted = false and i.availableStock > i.minThreshold")
    long countHealthyStock();

    @Query("select coalesce(sum(i.physicalStock), 0) from Inventory i where i.isDeleted = false")
    long sumPhysical();

    @Query("select coalesce(sum(i.reservedStock), 0) from Inventory i where i.isDeleted = false")
    long sumReserved();

    @Query("select coalesce(sum(i.availableStock), 0) from Inventory i where i.isDeleted = false")
    long sumAvailable();

    /** Exception rows (available <= threshold), cheapest-first, bounded by the page request. */
    @Query("select i from Inventory i where i.isDeleted = false and i.availableStock <= i.minThreshold "
            + "order by i.availableStock asc, i.variant.id asc")
    java.util.List<Inventory> findExceptions(org.springframework.data.domain.Pageable pageable);
}
