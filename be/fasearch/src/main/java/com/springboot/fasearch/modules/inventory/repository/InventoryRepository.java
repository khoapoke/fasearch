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
}
