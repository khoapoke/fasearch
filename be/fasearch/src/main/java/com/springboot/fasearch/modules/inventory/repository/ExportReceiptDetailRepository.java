package com.springboot.fasearch.modules.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.inventory.entity.ExportReceiptDetail;

public interface ExportReceiptDetailRepository extends JpaRepository<ExportReceiptDetail, Long> {
}
