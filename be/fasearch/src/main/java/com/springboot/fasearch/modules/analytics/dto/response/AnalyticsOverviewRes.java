package com.springboot.fasearch.modules.analytics.dto.response;

import java.math.BigDecimal;
import java.util.List;

/**
 * Aggregated figures for the admin report "Tổng hợp" tab. Every figure is computed in SQL over the
 * half-open range [startDate 00:00, endDate+1 00:00). See api-analytics.md section 4 for definitions.
 */
public record AnalyticsOverviewRes(
        Kpi kpi,
        List<CategoryRevenue> byCategory,
        List<StatusCount> byStatus,
        List<PaymentSlice> byPayment,
        List<TopCustomer> topCustomers) {

    /** Revenue and orders: paid invoices (same as the revenue report); newCustomers: first order in range. */
    public record Kpi(BigDecimal revenue, long orders, BigDecimal averageOrderValue, long newCustomers) {
    }

    /** Line value of paid invoices: quantity x unit price - line discounts - points discount. */
    public record CategoryRevenue(Long categoryId, String categoryName, BigDecimal revenue, long quantity) {
    }

    /** Orders created in range (not DRAFT, not soft-deleted) by status. */
    public record StatusCount(String status, long orders, BigDecimal total) {
    }

    /** Paid invoices by payment method code (null code folds into OTHER). */
    public record PaymentSlice(String method, long invoices, BigDecimal revenue) {
    }

    public record TopCustomer(Long customerId, String name, boolean deleted, long orders, BigDecimal revenue,
            java.time.LocalDateTime lastOrderAt) {
    }
}
