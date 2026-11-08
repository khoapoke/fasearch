package com.springboot.fasearch.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryMovementRes {

    private Long skuId;
    private String productName;
    private String color;
    private String size;
    private String barcode;
    /** Always null: no month-end stock history in schema, so an opening balance cannot be derived. See coverage.openingStockNote. */
    private Long openingStock;
    /** Units on COMPLETED import receipts created in the month (0 when none). */
    private Long totalImport;
    private long totalSold;
    /** Units on COMPLETED DAMAGED export receipts created in the month (0 when none). Not part of totalSold. */
    private Long totalDamaged;
    /** Current available snapshot (ton_kho.so_luong_kha_dung), NOT a recomputed close. */
    private long closingStock;
}
