package com.springboot.fasearch.modules.inventory.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.inventory.entity.ImportReceiptDetail;

public interface ImportReceiptDetailRepository extends JpaRepository<ImportReceiptDetail, Long> {

    List<ImportReceiptDetail> findByReceiptId(Long receiptId);
}
