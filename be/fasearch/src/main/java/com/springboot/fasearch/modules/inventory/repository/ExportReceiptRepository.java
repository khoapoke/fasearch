package com.springboot.fasearch.modules.inventory.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.modules.inventory.entity.ExportReceipt;

public interface ExportReceiptRepository extends JpaRepository<ExportReceipt, Long>, JpaSpecificationExecutor<ExportReceipt> {

    Optional<ExportReceipt> findByReceiptCode(String receiptCode);

    boolean existsByReceiptCode(String receiptCode);

    long countByReceiptCodeStartingWith(String prefix);
}
