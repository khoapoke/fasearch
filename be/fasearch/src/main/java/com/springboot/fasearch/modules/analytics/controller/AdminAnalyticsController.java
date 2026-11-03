package com.springboot.fasearch.modules.analytics.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.analytics.dto.response.InventoryMovementRes;
import com.springboot.fasearch.modules.analytics.dto.response.RevenueReportRes;
import com.springboot.fasearch.modules.analytics.dto.response.TopProductRes;
import com.springboot.fasearch.modules.analytics.service.interfaces.AnalyticsService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;

/** Admin-only read-only reports over existing paid snapshots. No writes, no schema change. */
@RestController
@RequestMapping("/api/v1/analytics")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminAnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/revenue")
    public ApiResponse<RevenueReportRes> revenue(
            @RequestParam(defaultValue = "DAY") String period,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "ALL") String channel) {
        if (!"ALL".equalsIgnoreCase(channel)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Channel split is not available: order rows carry no sales-channel column");
        }
        return ApiResponse.success(200, "Lấy báo cáo doanh thu thành công",
                analyticsService.revenue(period, startDate, endDate));
    }

    @GetMapping("/top-products")
    public ApiResponse<List<TopProductRes>> topProducts(
            @RequestParam(defaultValue = "BEST_SELLER") String type,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ApiResponse.success(200, "Lấy báo cáo sản phẩm thành công",
                analyticsService.topProducts(type, limit, startDate, endDate));
    }

    @GetMapping("/inventory-movement")
    public ApiResponse<PageResponse<InventoryMovementRes>> inventoryMovement(
            @RequestParam int year,
            @RequestParam int month,
            @RequestParam(required = false) Long sku,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (year < 2000 || year > 2100) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid year");
        }
        return ApiResponse.success(200, "Lấy báo cáo xuất - nhập - tồn thành công",
                analyticsService.inventoryMovement(year, month, sku, page, size));
    }

}
