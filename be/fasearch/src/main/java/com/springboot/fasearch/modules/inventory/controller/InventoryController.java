package com.springboot.fasearch.modules.inventory.controller;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.common.enums.ExportType;
import com.springboot.fasearch.common.enums.StocktakeStatus;
import com.springboot.fasearch.modules.inventory.dto.request.ExportReceiptCreateReq;
import com.springboot.fasearch.modules.inventory.dto.request.ImportReceiptCreateReq;
import com.springboot.fasearch.modules.inventory.dto.request.StocktakeCreateReq;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.modules.inventory.dto.response.StocktakeDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.StocktakeRes;
import com.springboot.fasearch.modules.inventory.service.interfaces.InventoryService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/stock")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<StockRes>> getStockList(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String keyword) {

        PageResponse<StockRes> result = inventoryService.getStockList(pageable, sku, productName, keyword);
        return ApiResponse.success(200, "Tra cứu tồn kho thành công", result);
    }

    @GetMapping("/stock/{skuId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<StockRes> getStockBySkuId(@PathVariable Long skuId) {
        StockRes result = inventoryService.getStockBySkuId(skuId);
        return ApiResponse.success(200, "Lấy thông tin tồn kho SKU thành công", result);
    }

    @PostMapping("/import-receipts")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ImportReceiptDetailRes> createImportReceipt(@Valid @RequestBody ImportReceiptCreateReq req) {
        ImportReceiptDetailRes result = inventoryService.createImportReceipt(req);
        return ApiResponse.success(201, "Tạo phiếu nhập kho thành công", result);
    }

    @GetMapping("/import-receipts")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<ImportReceiptRes>> getImportReceipts(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String receiptCode,
            @RequestParam(required = false) String supplierName) {

        PageResponse<ImportReceiptRes> result = inventoryService.getImportReceipts(pageable, receiptCode, supplierName);
        return ApiResponse.success(200, "Lấy danh sách phiếu nhập kho thành công", result);
    }

    @GetMapping("/import-receipts/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<ImportReceiptDetailRes> getImportReceiptById(@PathVariable Long id) {
        ImportReceiptDetailRes result = inventoryService.getImportReceiptById(id);
        return ApiResponse.success(200, "Lấy chi tiết phiếu nhập kho thành công", result);
    }

    @PostMapping("/export-receipts")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ExportReceiptDetailRes> createExportReceipt(@Valid @RequestBody ExportReceiptCreateReq req) {
        ExportReceiptDetailRes result = inventoryService.createExportReceipt(req);
        return ApiResponse.success(201, "Tạo phiếu xuất kho thành công", result);
    }

    @GetMapping("/export-receipts")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<ExportReceiptRes>> getExportReceipts(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String receiptCode,
            @RequestParam(required = false) ExportType exportType) {

        PageResponse<ExportReceiptRes> result = inventoryService.getExportReceipts(pageable, receiptCode, exportType);
        return ApiResponse.success(200, "Lấy danh sách phiếu xuất kho thành công", result);
    }

    @GetMapping("/export-receipts/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<ExportReceiptDetailRes> getExportReceiptById(@PathVariable Long id) {
        ExportReceiptDetailRes result = inventoryService.getExportReceiptById(id);
        return ApiResponse.success(200, "Lấy chi tiết phiếu xuất kho thành công", result);
    }

    @PostMapping("/stocktakes")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<StocktakeDetailRes> createStocktake(@Valid @RequestBody StocktakeCreateReq req) {
        StocktakeDetailRes result = inventoryService.createStocktake(req);
        return ApiResponse.success(201, "Ghi nhận phiếu kiểm kê thành công", result);
    }

    @GetMapping("/stocktakes")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<StocktakeRes>> getStocktakes(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String stocktakeCode,
            @RequestParam(required = false) StocktakeStatus status) {

        PageResponse<StocktakeRes> result = inventoryService.getStocktakes(pageable, stocktakeCode, status);
        return ApiResponse.success(200, "Lấy danh sách phiếu kiểm kê thành công", result);
    }

    @GetMapping("/stocktakes/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<StocktakeDetailRes> getStocktakeById(@PathVariable Long id) {
        StocktakeDetailRes result = inventoryService.getStocktakeById(id);
        return ApiResponse.success(200, "Lấy chi tiết phiếu kiểm kê thành công", result);
    }
}
