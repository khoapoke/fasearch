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

import com.springboot.fasearch.common.enums.StocktakeStatus;
import com.springboot.fasearch.modules.inventory.dto.request.StocktakeCreateReq;
import com.springboot.fasearch.modules.inventory.dto.response.StocktakeDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.StocktakeRes;

public interface InventoryService {

    PageResponse<StockRes> getStockList(Pageable pageable, String sku, String productName, String keyword);

    StockRes getStockBySkuId(Long skuId);

    /** Bounded, server-computed stock overview (counts are whole-catalog aggregates). */
    com.springboot.fasearch.modules.inventory.dto.response.StockSummaryRes getStockSummary(int limit);

    ImportReceiptDetailRes createImportReceipt(ImportReceiptCreateReq req);

    PageResponse<ImportReceiptRes> getImportReceipts(Pageable pageable, String receiptCode, String supplierName);

    ImportReceiptDetailRes getImportReceiptById(Long id);

    ExportReceiptDetailRes createExportReceipt(ExportReceiptCreateReq req);

    PageResponse<ExportReceiptRes> getExportReceipts(Pageable pageable, String receiptCode, ExportType exportType);

    ExportReceiptDetailRes getExportReceiptById(Long id);

    StocktakeDetailRes createStocktake(StocktakeCreateReq req);

    PageResponse<StocktakeRes> getStocktakes(Pageable pageable, String stocktakeCode, StocktakeStatus status);

    StocktakeDetailRes getStocktakeById(Long id);
}
