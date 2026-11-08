package com.springboot.fasearch.modules.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.analytics.dto.response.RevenueReportRes;
import com.springboot.fasearch.modules.analytics.dto.response.TopProductRes;
import com.springboot.fasearch.modules.analytics.repository.AnalyticsReadRepository;
import com.springboot.fasearch.modules.analytics.service.impl.AnalyticsServiceImpl;

/** Math + boundary tests for read-only analytics. Repository rows are stubbed; no DB. */
@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private AnalyticsReadRepository repository;

    @InjectMocks
    private AnalyticsServiceImpl service;

    private static Object[] invoice(long id, LocalDateTime issued, String amount, long orderId) {
        return new Object[] { id, issued, new BigDecimal(amount), orderId };
    }

    @Test
    void revenueSumsPaidOnlyAndBucketsByDay() {
        when(repository.paidInvoicesInRange(anyString(), anyString())).thenReturn(List.of(
                invoice(1, LocalDateTime.of(2026, 11, 2, 10, 0), "728000", 3),
                invoice(2, LocalDateTime.of(2026, 11, 2, 16, 0), "519000", 2)));
        when(repository.countUnpaidOrdersByStatus("PENDING", "2026-11-01 00:00:00", "2026-11-03 00:00:00"))
                .thenReturn(9L);
        when(repository.countUnpaidOrdersByStatus("CANCELLED", "2026-11-01 00:00:00", "2026-11-03 00:00:00"))
                .thenReturn(0L);
        when(repository.countSoftDeletedProductsWithPaidSales("2026-11-01 00:00:00", "2026-11-03 00:00:00"))
                .thenReturn(0L);
        RevenueReportRes report = service.revenue("DAY", LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2));
        assertEquals(new BigDecimal("1247000"), report.getSummary().getTotalRevenue());
        assertEquals(2, report.getSummary().getTotalOrders());
        assertEquals(new BigDecimal("623500.00"), report.getSummary().getAverageOrderValue());
        assertNull(report.getSummary().getTotalCogs());
        assertNull(report.getSummary().getGrossProfit());
        assertEquals(1, report.getTimeline().size());
        assertEquals("2026-11-02", report.getTimeline().get(0).getDate());
        assertEquals(9, report.getCoverage().getExcludedPending());
    }

    @Test
    void revenueRejectsBadRangeAndPeriod() {
        assertThrows(AppException.class,
                () -> service.revenue("DAY", LocalDate.of(2026, 11, 3), LocalDate.of(2026, 11, 1)));
        assertThrows(AppException.class,
                () -> service.revenue("FORTNIGHT", LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2)));
    }

    private static Object[] salesRow(long sku, long product, String name, long qty, String revenue,
            long softDeleted, long stock) {
        return new Object[] { sku, product, name, "Ao", "Den", "M", "BC-" + sku, qty,
                new BigDecimal(revenue), softDeleted, stock };
    }

    @Test
    void bestSellerRanksByPaidQuantity() {
        when(repository.productSalesInRange(anyString(), anyString())).thenReturn(List.<Object[]>of(
                salesRow(1, 1, "Ao A", 3, "600000", 0, 5),
                salesRow(2, 2, "Ao B", 9, "900000", 0, 2)));
        List<TopProductRes> result = service.topProducts("BEST_SELLER", 10,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2));
        assertEquals(2, result.size());
        assertEquals(1, result.get(0).getRank());
        assertEquals(2L, result.get(0).getProductId());
        assertEquals(9, result.get(0).getTotalQuantitySold());
    }

    @Test
    void slowMovingKeepsOnlyZeroSellers() {
        when(repository.productSalesInRange(anyString(), anyString())).thenReturn(List.<Object[]>of(
                salesRow(1, 1, "Ao A", 0, "0", 0, 5),
                salesRow(2, 2, "Ao B", 4, "400000", 0, 2)));
        List<TopProductRes> result = service.topProducts("SLOW_MOVING", 10,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2));
        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).getProductId());
    }

    @Test
    void inventoryMovementFillsImportAndDamagedFromReceiptsAndKeepsOpeningNull() {
        when(repository.skuMovementInMonth(anyString(), org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(List.<Object[]>of(new Object[] { 7L, "Ao X", "Den", "M", "BC-7", 2L, 9L },
                        new Object[] { 8L, "Ao Y", "Den", "L", "BC-8", 0L, 4L }));
        when(repository.importedUnitsInRange(org.mockito.ArgumentMatchers.anyCollection(),
                org.mockito.ArgumentMatchers.eq("2026-11-01 00:00:00"), org.mockito.ArgumentMatchers.eq("2026-12-01 00:00:00")))
                .thenReturn(List.<Object[]>of(new Object[] { 7L, 5L }));
        when(repository.damagedUnitsInRange(org.mockito.ArgumentMatchers.anyCollection(),
                org.mockito.ArgumentMatchers.eq("2026-11-01 00:00:00"), org.mockito.ArgumentMatchers.eq("2026-12-01 00:00:00")))
                .thenReturn(List.<Object[]>of(new Object[] { 7L, 3L }));
        var page = service.inventoryMovement(2026, 11, null, 0, 10);
        assertEquals(2, page.getTotalElements());
        var row = page.getContent().get(0);
        assertNull(row.getOpeningStock());
        assertEquals(5L, row.getTotalImport());
        assertEquals(3L, row.getTotalDamaged());
        assertEquals(2, row.getTotalSold());
        assertEquals(9, row.getClosingStock());
        var none = page.getContent().get(1);
        assertEquals(0L, none.getTotalImport());
        assertEquals(0L, none.getTotalDamaged());
    }

    @Test
    void inventoryMovementRejectsBadMonth() {
        assertThrows(AppException.class, () -> service.inventoryMovement(2026, 13, null, 0, 10));
    }
}
