package com.springboot.fasearch.modules.csv;

import java.math.BigDecimal;
import java.util.List;

/**
 * A product that a clean CSV file would create as one draft, with every SKU row belonging to it.
 * Stock is deliberately absent: quantities go through import receipts (D9).
 */
public record CsvImportProduct(
        String identityKey,
        String productName,
        Long categoryId,
        Long brandId,
        String modelCode,
        String material,
        String style,
        BigDecimal price,
        List<Variant> variants) {

    public record Variant(String color, String size, String barcode, BigDecimal additionalPrice) {
    }
}
