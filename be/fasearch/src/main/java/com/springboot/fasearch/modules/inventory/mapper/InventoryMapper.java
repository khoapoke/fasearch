package com.springboot.fasearch.modules.inventory.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptItemRes;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptItemRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.modules.inventory.dto.response.StocktakeDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.StocktakeDiscrepancyRes;
import com.springboot.fasearch.modules.inventory.dto.response.StocktakeRes;
import com.springboot.fasearch.modules.inventory.entity.ExportReceipt;
import com.springboot.fasearch.modules.inventory.entity.ExportReceiptDetail;
import com.springboot.fasearch.modules.inventory.entity.ImportReceipt;
import com.springboot.fasearch.modules.inventory.entity.ImportReceiptDetail;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.entity.Stocktake;
import com.springboot.fasearch.modules.inventory.entity.StocktakeDetail;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface InventoryMapper {

    @Mapping(source = "variant.id", target = "skuId")
    @Mapping(source = "variant.product.id", target = "productId")
    @Mapping(source = "variant.product.productName", target = "productName")
    @Mapping(source = "variant.product.status", target = "productStatus")
    @Mapping(source = "variant.color", target = "color")
    @Mapping(source = "variant.size", target = "size")
    @Mapping(source = "variant.barcode", target = "barcode")
    StockRes toStockResponse(Inventory inventory);

    List<StockRes> toStockResponseList(List<Inventory> inventories);

    @Mapping(source = "id", target = "receiptId")
    @Mapping(target = "totalItems", expression = "java(receipt.getDetails() != null ? receipt.getDetails().size() : 0)")
    ImportReceiptRes toImportReceiptResponse(ImportReceipt receipt);

    List<ImportReceiptRes> toImportReceiptResponseList(List<ImportReceipt> receipts);

    // Tên/màu/cỡ/mã vạch do tầng service điền từ HistoryNameLookup (SQL gốc, không qua proxy
    // @SQLRestriction) để chứng từ cũ vẫn đọc được khi SKU hoặc sản phẩm đã xóa mềm.
    @Mapping(source = "variant.id", target = "skuId")
    ImportReceiptItemRes toImportReceiptItemResponse(ImportReceiptDetail detail);

    List<ImportReceiptItemRes> toImportReceiptItemResponseList(List<ImportReceiptDetail> details);

    @Mapping(source = "id", target = "receiptId")
    @Mapping(target = "totalItems", expression = "java(receipt.getDetails() != null ? receipt.getDetails().size() : 0)")
    @Mapping(source = "details", target = "items")
    ImportReceiptDetailRes toImportReceiptDetailResponse(ImportReceipt receipt);

    @Mapping(source = "id", target = "receiptId")
    @Mapping(target = "totalItems", expression = "java(receipt.getDetails() != null ? receipt.getDetails().size() : 0)")
    ExportReceiptRes toExportReceiptResponse(ExportReceipt receipt);

    List<ExportReceiptRes> toExportReceiptResponseList(List<ExportReceipt> receipts);

    // Tên/màu/cỡ/mã vạch do tầng service điền từ HistoryNameLookup (SQL gốc, không qua proxy
    // @SQLRestriction) để chứng từ cũ vẫn đọc được khi SKU hoặc sản phẩm đã xóa mềm.
    @Mapping(source = "variant.id", target = "skuId")
    ExportReceiptItemRes toExportReceiptItemResponse(ExportReceiptDetail detail);

    List<ExportReceiptItemRes> toExportReceiptItemResponseList(List<ExportReceiptDetail> details);

    @Mapping(source = "id", target = "receiptId")
    @Mapping(target = "totalItems", expression = "java(receipt.getDetails() != null ? receipt.getDetails().size() : 0)")
    @Mapping(source = "details", target = "items")
    ExportReceiptDetailRes toExportReceiptDetailResponse(ExportReceipt receipt);

    @Mapping(source = "id", target = "stocktakeId")
    @Mapping(target = "totalItems", expression = "java(stocktake.getDetails() != null ? stocktake.getDetails().size() : 0)")
    StocktakeRes toStocktakeResponse(Stocktake stocktake);

    List<StocktakeRes> toStocktakeResponseList(List<Stocktake> stocktakes);

    // Tên/màu/cỡ/mã vạch do tầng service điền từ HistoryNameLookup (SQL gốc, không qua proxy
    // @SQLRestriction) để chứng từ cũ vẫn đọc được khi SKU hoặc sản phẩm đã xóa mềm.
    @Mapping(source = "variant.id", target = "skuId")
    StocktakeDiscrepancyRes toStocktakeDiscrepancyResponse(StocktakeDetail detail);

    List<StocktakeDiscrepancyRes> toStocktakeDiscrepancyResponseList(List<StocktakeDetail> details);

    @Mapping(source = "id", target = "stocktakeId")
    @Mapping(source = "details", target = "discrepancies")
    StocktakeDetailRes toStocktakeDetailResponse(Stocktake stocktake);
}
