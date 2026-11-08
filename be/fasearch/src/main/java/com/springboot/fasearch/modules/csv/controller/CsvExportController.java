package com.springboot.fasearch.modules.csv.controller;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.csv.CsvExportPlan;
import com.springboot.fasearch.modules.csv.service.interfaces.CsvExportService;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * CSV exports of the admin lists. Filters are the same query parameters as the list pages, so the
 * file contains every matching row, not only the current page.
 */
@RestController
@RequestMapping("/api/v1/admin/csv")
@PreAuthorize("hasAuthority('PERM_DATA_EXPORT') and hasAuthority('PERM_PRODUCT_VIEW') and hasAuthority('PERM_INVENTORY_VIEW') and hasAuthority('PERM_ORDER_VIEW') and hasAuthority('PERM_CUSTOMER_VIEW')")
@SecurityRequirement(name = "BearerAuth")
@RequiredArgsConstructor
public class CsvExportController {

    private static final String CSV_CONTENT_TYPE = "text/csv; charset=UTF-8";

    private final CsvExportService csvExportService;

    @GetMapping("/products")
    @PreAuthorize("hasAuthority('PERM_DATA_EXPORT') and hasAuthority('PERM_PRODUCT_VIEW')")
    public void products(
            HttpServletResponse response,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) ProductStatus status,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) Long brandId) throws IOException {
        write(response, csvExportService.prepareProducts(
                keyword, categoryId, minPrice, maxPrice, status, brand, brandId));
    }

    @GetMapping("/stock")
    @PreAuthorize("hasAuthority('PERM_DATA_EXPORT') and hasAuthority('PERM_INVENTORY_VIEW')")
    public void stock(
            HttpServletResponse response,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String keyword) throws IOException {
        write(response, csvExportService.prepareStock(sku, productName, keyword));
    }

    @GetMapping("/orders")
    @PreAuthorize("hasAuthority('PERM_DATA_EXPORT') and hasAuthority('PERM_ORDER_VIEW')")
    public void orders(
            HttpServletResponse response,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String orderCode,
            @RequestParam(required = false) String customerPhone,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String keyword) throws IOException {
        write(response, csvExportService.prepareOrders(
                status, orderCode, customerPhone, startDate, endDate, keyword));
    }

    @GetMapping("/customers")
    @PreAuthorize("hasAuthority('PERM_DATA_EXPORT') and hasAuthority('PERM_CUSTOMER_VIEW')")
    public void customers(
            HttpServletResponse response,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long tierId,
            @RequestParam(required = false) Long salesTierId) throws IOException {
        write(response, csvExportService.prepareCustomers(keyword, tierId, salesTierId));
    }

    private static void write(HttpServletResponse response, CsvExportPlan plan) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(CSV_CONTENT_TYPE);
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + plan.filename() + "\"");
        response.setHeader("X-Export-Rows", Long.toString(plan.rows()));
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        plan.content().writeTo(response.getOutputStream());
        response.flushBuffer();
    }
}
