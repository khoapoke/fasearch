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
import com.springboot.fasearch.modules.inventory.entity.ExportReceipt;
import com.springboot.fasearch.modules.inventory.entity.ExportReceiptDetail;
import com.springboot.fasearch.modules.inventory.entity.ImportReceipt;
import com.springboot.fasearch.modules.inventory.entity.ImportReceiptDetail;
import com.springboot.fasearch.modules.inventory.entity.Inventory;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface InventoryMapper {

    @Mapping(source = "variant.id", target = "skuId")
    @Mapping(source = "variant.product.id", target = "productId")
    @Mapping(source = "variant.product.productName", target = "productName")
    @Mapping(source = "variant.color", target = "color")
    @Mapping(source = "variant.size", target = "size")
    @Mapping(source = "variant.barcode", target = "barcode")
    StockRes toStockResponse(Inventory inventory);

    List<StockRes> toStockResponseList(List<Inventory> inventories);

    @Mapping(source = "id", target = "receiptId")
    @Mapping(target = "totalItems", expression = "java(receipt.getDetails() != null ? receipt.getDetails().size() : 0)")
    ImportReceiptRes toImportReceiptResponse(ImportReceipt receipt);

    List<ImportReceiptRes> toImportReceiptResponseList(List<ImportReceipt> receipts);

    @Mapping(source = "variant.id", target = "skuId")
    @Mapping(source = "variant.product.productName", target = "productName")
    @Mapping(source = "variant.color", target = "color")
    @Mapping(source = "variant.size", target = "size")
    @Mapping(source = "variant.barcode", target = "barcode")
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

    @Mapping(source = "variant.id", target = "skuId")
    @Mapping(source = "variant.product.productName", target = "productName")
    @Mapping(source = "variant.color", target = "color")
    @Mapping(source = "variant.size", target = "size")
    @Mapping(source = "variant.barcode", target = "barcode")
    ExportReceiptItemRes toExportReceiptItemResponse(ExportReceiptDetail detail);

    List<ExportReceiptItemRes> toExportReceiptItemResponseList(List<ExportReceiptDetail> details);

    @Mapping(source = "id", target = "receiptId")
    @Mapping(target = "totalItems", expression = "java(receipt.getDetails() != null ? receipt.getDetails().size() : 0)")
    @Mapping(source = "details", target = "items")
    ExportReceiptDetailRes toExportReceiptDetailResponse(ExportReceipt receipt);
}
