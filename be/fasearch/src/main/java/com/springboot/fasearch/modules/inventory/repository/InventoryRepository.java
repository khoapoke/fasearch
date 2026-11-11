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

    /** Historical return must work even when its SKU/product was soft-deleted. */
    @Query(value = "select * from ton_kho where ma_sku=:skuId and da_xoa=false for update", nativeQuery = true)
    Optional<Inventory> findForReturn(@Param("skuId") Long skuId);

    boolean existsByVariantId(Long skuId);

    /** Storefront: tồn khả dụng theo lô SKU của một sản phẩm (một truy vấn, không N+1). */
    @Query("select i from Inventory i join fetch i.variant where i.variant.id in :skuIds")
    java.util.List<Inventory> findByVariantIdIn(@Param("skuIds") java.util.Collection<Long> skuIds);

    /** One query for a CSV batch: SKU and product are fetched with the stock row. */
    @Query("select i from Inventory i join fetch i.variant v join fetch v.product p where i.id in :ids")
    java.util.List<Inventory> findExportRowsByIdIn(@Param("ids") java.util.Collection<Long> ids);

    /*
     * Overview aggregates. Every count is evaluated by the database over all live stock rows so the
     * Overview never infers global numbers from a page of results. "Available" is the persisted
     * so_luong_kha_dung column (physical - reserved), not a recomputation.
     *
     * A stock row of a soft-deleted SKU (or of a SKU whose product is soft-deleted) is not part of
     * the live list, so every aggregate filters it out: totals must agree with the visible rows.
     */
    String LIVE_STOCK = " i.isDeleted = false and i.variant.isDeleted = false "
            + "and i.variant.product.isDeleted = false ";

    @Query("select count(i) from Inventory i where" + LIVE_STOCK)
    long countLive();

    @Query("select count(i) from Inventory i where" + LIVE_STOCK + "and i.availableStock <= 0")
    long countOutOfStock();

    @Query("select count(i) from Inventory i where" + LIVE_STOCK + "and i.availableStock > 0 "
            + "and i.availableStock <= i.minThreshold")
    long countLowStock();

    @Query("select count(i) from Inventory i where" + LIVE_STOCK + "and i.availableStock > i.minThreshold")
    long countHealthyStock();

    @Query("select coalesce(sum(i.physicalStock), 0) from Inventory i where" + LIVE_STOCK)
    long sumPhysical();

    @Query("select coalesce(sum(i.reservedStock), 0) from Inventory i where" + LIVE_STOCK)
    long sumReserved();

    @Query("select coalesce(sum(i.availableStock), 0) from Inventory i where" + LIVE_STOCK)
    long sumAvailable();

    /** Exception rows (available <= threshold), cheapest-first, bounded by the page request. */
    @Query("select i from Inventory i where" + LIVE_STOCK + "and i.availableStock <= i.minThreshold "
            + "order by i.availableStock asc, i.variant.id asc")
    java.util.List<Inventory> findExceptions(org.springframework.data.domain.Pageable pageable);
}
