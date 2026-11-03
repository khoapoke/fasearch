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
    /** Always null: no warehouse/opening history in schema. See coverage.openingStockNote. */
    private Long openingStock;
    /** Always null: receipt detail rows are absent. Only current snapshot is reported. */
    private Long totalImport;
    private long totalSold;
    /** Always null: no damage/loss history in schema. */
    private Long totalDamaged;
    /** Current available snapshot (ton_kho.so_luong_kha_dung), NOT a recomputed close. */
    private long closingStock;
}
