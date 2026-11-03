package com.springboot.fasearch.modules.analytics.service.interfaces;

import java.time.LocalDate;

import com.springboot.fasearch.modules.analytics.dto.response.RevenueReportRes;
import com.springboot.fasearch.shared.PageResponse;
import com.springboot.fasearch.modules.analytics.dto.response.InventoryMovementRes;
import com.springboot.fasearch.modules.analytics.dto.response.TopProductRes;

public interface AnalyticsService {

    RevenueReportRes revenue(String period, LocalDate startDate, LocalDate endDate);

    java.util.List<TopProductRes> topProducts(String type, int limit, LocalDate startDate, LocalDate endDate);

    PageResponse<InventoryMovementRes> inventoryMovement(int year, int month, Long skuId, int page, int size);
}
