package com.springboot.fasearch.modules.inventory.service.impl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.ExportType;
import com.springboot.fasearch.common.enums.ReceiptStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.dto.request.ExportReceiptCreateReq;
import com.springboot.fasearch.modules.inventory.dto.request.ExportReceiptItemReq;
import com.springboot.fasearch.modules.inventory.dto.request.ImportReceiptCreateReq;
import com.springboot.fasearch.modules.inventory.dto.request.ImportReceiptItemReq;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ExportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptDetailRes;
import com.springboot.fasearch.modules.inventory.dto.response.ImportReceiptRes;
import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.modules.inventory.entity.ExportReceipt;
import com.springboot.fasearch.modules.inventory.entity.ExportReceiptDetail;
import com.springboot.fasearch.modules.inventory.entity.ImportReceipt;
import com.springboot.fasearch.modules.inventory.entity.ImportReceiptDetail;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.mapper.InventoryMapper;
import com.springboot.fasearch.modules.inventory.repository.ExportReceiptDetailRepository;
import com.springboot.fasearch.modules.inventory.repository.ExportReceiptRepository;
import com.springboot.fasearch.modules.inventory.repository.ImportReceiptDetailRepository;
import com.springboot.fasearch.modules.inventory.repository.ImportReceiptRepository;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.inventory.service.interfaces.InventoryService;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final ImportReceiptRepository importReceiptRepository;
    private final ImportReceiptDetailRepository importReceiptDetailRepository;
    private final ExportReceiptRepository exportReceiptRepository;
    private final ExportReceiptDetailRepository exportReceiptDetailRepository;
    private final ProductVariantRepository productVariantRepository;
    private final InventoryMapper inventoryMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<StockRes> getStockList(Pageable pageable, String sku, String productName, String keyword) {
        Specification<Inventory> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<Inventory, ProductVariant> variantJoin = root.join("variant", JoinType.LEFT);
            Join<Object, Object> productJoin = variantJoin.join("product", JoinType.LEFT);

            if (sku != null && !sku.isBlank()) {
                String cleanSku = sku.trim();
                Predicate skuIdMatch = cb.disjunction();
                if (cleanSku.matches("^\\d+$")) {
                    try {
                        skuIdMatch = cb.equal(variantJoin.get("id"), Long.parseLong(cleanSku));
                    } catch (NumberFormatException ignored) {
                    }
                }
                Predicate barcodeMatch = cb.like(cb.lower(variantJoin.get("barcode")), "%" + cleanSku.toLowerCase() + "%");
                predicates.add(cb.or(skuIdMatch, barcodeMatch));
            }

            if (productName != null && !productName.isBlank()) {
                predicates.add(cb.like(cb.lower(productJoin.get("productName")), "%" + productName.trim().toLowerCase() + "%"));
            }

            if (keyword != null && !keyword.isBlank()) {
                String cleanKeyword = "%" + keyword.trim().toLowerCase() + "%";
                Predicate nameMatch = cb.like(cb.lower(productJoin.get("productName")), cleanKeyword);
                Predicate colorMatch = cb.like(cb.lower(variantJoin.get("color")), cleanKeyword);
                Predicate sizeMatch = cb.like(cb.lower(variantJoin.get("size")), cleanKeyword);
                Predicate barcodeMatch = cb.like(cb.lower(variantJoin.get("barcode")), cleanKeyword);
                predicates.add(cb.or(nameMatch, colorMatch, sizeMatch, barcodeMatch));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Inventory> inventoryPage = inventoryRepository.findAll(spec, pageable);
        List<StockRes> content = inventoryMapper.toStockResponseList(inventoryPage.getContent());

        return PageResponse.<StockRes>builder()
                .content(content)
                .pageNumber(inventoryPage.getNumber())
                .pageSize(inventoryPage.getSize())
                .totalElements(inventoryPage.getTotalElements())
                .totalPages(inventoryPage.getTotalPages())
                .isLast(inventoryPage.isLast())
                .build();
    }

    @Override
    @Transactional
    public StockRes getStockBySkuId(Long skuId) {
        ProductVariant variant = productVariantRepository.findById(skuId)
                .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));

        Inventory inventory = inventoryRepository.findByVariantId(skuId)
                .orElseGet(() -> {
                    Inventory newInv = Inventory.builder()
                            .variant(variant)
                            .physicalStock(0)
                            .reservedStock(0)
                            .availableStock(0)
                            .minThreshold(10)
                            .isDeleted(false)
                            .build();
                    return inventoryRepository.save(newInv);
                });

        return inventoryMapper.toStockResponse(inventory);
    }

    @Override
    @Transactional
    public ImportReceiptDetailRes createImportReceipt(ImportReceiptCreateReq req) {
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new AppException(ErrorCode.INVALID_RECEIPT_ITEM);
        }

        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "NK-" + dateStr + "-";
        long nextSequence = importReceiptRepository.countByReceiptCodeStartingWith(prefix) + 1;
        String receiptCode = String.format("%s%03d", prefix, nextSequence);

        while (importReceiptRepository.existsByReceiptCode(receiptCode)) {
            nextSequence++;
            receiptCode = String.format("%s%03d", prefix, nextSequence);
        }

        ImportReceipt receipt = ImportReceipt.builder()
                .receiptCode(receiptCode)
                .supplierName(req.getSupplierName().trim())
                .note(req.getNote())
                .status(ReceiptStatus.COMPLETED)
                .totalQuantity(0)
                .totalAmount(BigDecimal.ZERO)
                .isDeleted(false)
                .build();

        ImportReceipt savedReceipt = importReceiptRepository.save(receipt);

        int totalQty = 0;
        BigDecimal totalAmt = BigDecimal.ZERO;
        List<ImportReceiptDetail> details = new ArrayList<>();

        for (ImportReceiptItemReq itemReq : req.getItems()) {
            ProductVariant variant = productVariantRepository.findById(itemReq.getSkuId())
                    .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));

            BigDecimal subTotal = itemReq.getImportPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            totalQty += itemReq.getQuantity();
            totalAmt = totalAmt.add(subTotal);

            // Cập nhật hoặc khởi tạo tồn kho cho SKU
            Inventory inv = inventoryRepository.findByVariantId(variant.getId())
                    .orElseGet(() -> Inventory.builder()
                            .variant(variant)
                            .physicalStock(0)
                            .reservedStock(0)
                            .availableStock(0)
                            .minThreshold(10)
                            .isDeleted(false)
                            .build());

            inv.setPhysicalStock(inv.getPhysicalStock() + itemReq.getQuantity());
            inv.setAvailableStock(inv.getPhysicalStock() - inv.getReservedStock());
            inventoryRepository.save(inv);

            ImportReceiptDetail detail = ImportReceiptDetail.builder()
                    .receipt(savedReceipt)
                    .variant(variant)
                    .quantity(itemReq.getQuantity())
                    .importPrice(itemReq.getImportPrice())
                    .subTotal(subTotal)
                    .isDeleted(false)
                    .build();

            details.add(importReceiptDetailRepository.save(detail));
        }

        savedReceipt.setTotalQuantity(totalQty);
        savedReceipt.setTotalAmount(totalAmt);
        savedReceipt.setDetails(details);
        importReceiptRepository.save(savedReceipt);

        return inventoryMapper.toImportReceiptDetailResponse(savedReceipt);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ImportReceiptRes> getImportReceipts(Pageable pageable, String receiptCode, String supplierName) {
        Specification<ImportReceipt> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (receiptCode != null && !receiptCode.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("receiptCode")), "%" + receiptCode.trim().toLowerCase() + "%"));
            }
            if (supplierName != null && !supplierName.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("supplierName")), "%" + supplierName.trim().toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ImportReceipt> page = importReceiptRepository.findAll(spec, pageable);
        List<ImportReceiptRes> content = inventoryMapper.toImportReceiptResponseList(page.getContent());

        return PageResponse.<ImportReceiptRes>builder()
                .content(content)
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .isLast(page.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public ImportReceiptDetailRes getImportReceiptById(Long id) {
        ImportReceipt receipt = importReceiptRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RECEIPT_NOT_FOUND));

        return inventoryMapper.toImportReceiptDetailResponse(receipt);
    }

    @Override
    @Transactional
    public ExportReceiptDetailRes createExportReceipt(ExportReceiptCreateReq req) {
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new AppException(ErrorCode.INVALID_RECEIPT_ITEM);
        }

        // 1. Kiểm tra tồn kho khả dụng trước khi thực hiện xuất
        Map<Long, Integer> skuQuantities = new HashMap<>();
        for (ExportReceiptItemReq item : req.getItems()) {
            skuQuantities.merge(item.getSkuId(), item.getQuantity(), 
                    (oldVal,newVal)->(oldVal==null?0:oldVal) +(newVal==null?0:newVal));
        }

        for (Map.Entry<Long, Integer> entry : skuQuantities.entrySet()) {
            Long skuId = entry.getKey();
            Integer requestedQty = entry.getValue();

            productVariantRepository.findById(skuId)
                    .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));

            Inventory inv = inventoryRepository.findByVariantId(skuId)
                    .orElseThrow(() -> new AppException(ErrorCode.INSUFFICIENT_STOCK));

            if (inv.getAvailableStock() < requestedQty) {
                throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
            }
        }

        // 2. Tạo mã phiếu xuất tự động XK-YYYYMMDD-XXX
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "XK-" + dateStr + "-";
        long nextSequence = exportReceiptRepository.countByReceiptCodeStartingWith(prefix) + 1;
        String receiptCode = String.format("%s%03d", prefix, nextSequence);

        while (exportReceiptRepository.existsByReceiptCode(receiptCode)) {
            nextSequence++;
            receiptCode = String.format("%s%03d", prefix, nextSequence);
        }

        ExportReceipt receipt = ExportReceipt.builder()
                .receiptCode(receiptCode)
                .exportType(req.getExportType())
                .note(req.getNote())
                .status(ReceiptStatus.COMPLETED)
                .totalQuantity(0)
                .isDeleted(false)
                .build();

        ExportReceipt savedReceipt = exportReceiptRepository.save(receipt);

        // 3. Trừ kho và lưu chi tiết phiếu xuất
        int totalQty = 0;
        List<ExportReceiptDetail> details = new ArrayList<>();

        for (ExportReceiptItemReq itemReq : req.getItems()) {
            ProductVariant variant = productVariantRepository.findById(itemReq.getSkuId())
                    .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));

            totalQty += itemReq.getQuantity();

            Inventory inv = inventoryRepository.findByVariantId(variant.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.INSUFFICIENT_STOCK));

            inv.setPhysicalStock(inv.getPhysicalStock() - itemReq.getQuantity());
            inv.setAvailableStock(inv.getPhysicalStock() - inv.getReservedStock());
            inventoryRepository.save(inv);

            ExportReceiptDetail detail = ExportReceiptDetail.builder()
                    .receipt(savedReceipt)
                    .variant(variant)
                    .quantity(itemReq.getQuantity())
                    .reason(itemReq.getReason())
                    .isDeleted(false)
                    .build();

            details.add(exportReceiptDetailRepository.save(detail));
        }

        savedReceipt.setTotalQuantity(totalQty);
        savedReceipt.setDetails(details);
        exportReceiptRepository.save(savedReceipt);

        return inventoryMapper.toExportReceiptDetailResponse(savedReceipt);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ExportReceiptRes> getExportReceipts(Pageable pageable, String receiptCode, ExportType exportType) {
        Specification<ExportReceipt> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (receiptCode != null && !receiptCode.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("receiptCode")), "%" + receiptCode.trim().toLowerCase() + "%"));
            }
            if (exportType != null) {
                predicates.add(cb.equal(root.get("exportType"), exportType));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ExportReceipt> page = exportReceiptRepository.findAll(spec, pageable);
        List<ExportReceiptRes> content = inventoryMapper.toExportReceiptResponseList(page.getContent());

        return PageResponse.<ExportReceiptRes>builder()
                .content(content)
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .isLast(page.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public ExportReceiptDetailRes getExportReceiptById(Long id) {
        ExportReceipt receipt = exportReceiptRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EXPORT_RECEIPT_NOT_FOUND));

        return inventoryMapper.toExportReceiptDetailResponse(receipt);
    }
}
