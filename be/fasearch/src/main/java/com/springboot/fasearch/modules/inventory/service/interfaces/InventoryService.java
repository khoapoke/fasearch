package com.springboot.fasearch.modules.inventory.service.interfaces;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.common.enums.ExportType;
import com.springboot.fasearch.modules.inventory.dto.request.ExportReceiptCreateReq;
import com.springboot.fasearch.modules.inventory.dto.request.ImportReceiptCreateReq;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.shared.PageResponse;

public interface InventoryService {

    PageResponse<StockRes> getStockList(Pageable pageable, String sku, String productName, String keyword);

    StockRes getStockBySkuId(Long skuId);

    ImportReceiptDetailRes createImportReceipt(ImportReceiptCreateReq req);

    PageResponse<ImportReceiptRes> getImportReceipts(Pageable pageable, String receiptCode, String supplierName);

    ImportReceiptDetailRes getImportReceiptById(Long id);

    ExportReceiptDetailRes createExportReceipt(ExportReceiptCreateReq req);

    PageResponse<ExportReceiptRes> getExportReceipts(Pageable pageable, String receiptCode, ExportType exportType);

    ExportReceiptDetailRes getExportReceiptById(Long id);
}
