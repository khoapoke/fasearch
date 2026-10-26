package com.springboot.fasearch.modules.inventory.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.modules.inventory.entity.ImportReceipt;

public interface ImportReceiptRepository extends JpaRepository<ImportReceipt, Long>, JpaSpecificationExecutor<ImportReceipt> {

    Optional<ImportReceipt> findByReceiptCode(String receiptCode);

    boolean existsByReceiptCode(String receiptCode);

    long countByReceiptCodeStartingWith(String prefix);
}
