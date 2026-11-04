package com.springboot.fasearch.modules.inventory.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Bounded, server-computed stock overview for the Admin live Overview.
 *
 * <p>Semantics (all counts come from real aggregate queries over the whole catalog, never from
 * a page slice):
 * <ul>
 *   <li>{@code availableStock} = physical − reserved (the persisted {@code so_luong_kha_dung}).</li>
 *   <li>{@code outOfStock}: available &lt;= 0.</li>
 *   <li>{@code lowStock}: 0 &lt; available &lt;= {@code minThreshold} (each SKU's own threshold).</li>
 *   <li>{@code healthyStock}: available &gt; minThreshold.</li>
 * </ul>
 * The exception list is deliberately capped: {@code exceptionsTotal} is the true row count and
 * {@code exceptions} holds at most {@code limit} rows, ordered by available ascending then SKU id.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockSummaryRes {

    private long totalSkus;
    private long outOfStock;
    private long lowStock;
    private long healthyStock;
    private long physicalTotal;
    private long reservedTotal;
    private long availableTotal;
    private long exceptionsTotal;
    private int limit;
    private LocalDateTime generatedAt;
    private List<StockRes> exceptions;
}
