package com.springboot.fasearch.modules.csv.service.interfaces;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.csv.CsvExportPlan;

/** Prepares the four admin CSV exports from the same filters as their list pages. */
public interface CsvExportService {

    CsvExportPlan prepareProducts(String keyword, Long categoryId, BigDecimal minPrice, BigDecimal maxPrice,
            ProductStatus status, String brand, Long brandId);

    CsvExportPlan prepareStock(String sku, String productName, String keyword);

    CsvExportPlan prepareOrders(OrderStatus status, String orderCode, String customerPhone,
            LocalDate startDate, LocalDate endDate, String keyword);

    CsvExportPlan prepareCustomers(String keyword, Long tierId, Long salesTierId);
}
