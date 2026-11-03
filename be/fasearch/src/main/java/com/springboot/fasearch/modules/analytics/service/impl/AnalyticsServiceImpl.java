package com.springboot.fasearch.modules.analytics.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.analytics.dto.response.AnalyticsCoverageRes;
import com.springboot.fasearch.modules.analytics.dto.response.InventoryMovementRes;
import com.springboot.fasearch.modules.analytics.dto.response.RevenueReportRes;
import com.springboot.fasearch.modules.analytics.dto.response.RevenueSummaryRes;
import com.springboot.fasearch.modules.analytics.dto.response.RevenueTimelineItem;
import com.springboot.fasearch.modules.analytics.dto.response.TopProductRes;
import com.springboot.fasearch.modules.analytics.repository.AnalyticsReadRepository;
import com.springboot.fasearch.modules.analytics.service.interfaces.AnalyticsService;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;

/**
 * Read-only analytics over existing paid snapshots. Every figure traces to invoices with
 * {@code PAID} status on non-draft, non-cancelled orders; anything unknowable from the schema
 * is an explicit null with a coverage note, never an invented zero.
 */
@Service
@RequiredArgsConstructor
public class AnalyticsServiceImpl implements AnalyticsService {

    private static final String CHANNEL_NOTE =
            "Order rows carry no sales-channel column: channel is ALL only; POS/ONLINE split is not reported.";
    private static final String COGS_NOTE =
            "No cost history in schema: totalCogs/grossProfit are null, never estimated.";
    private static final String OPENING_NOTE =
            "No warehouse/opening history in schema and receipt detail rows are absent: "
            + "openingStock/totalImport/totalDamaged are null (Chưa đủ dữ liệu); "
            + "closingStock is the current available snapshot, not a recomputed close.";

    private final AnalyticsReadRepository repository;

    private static String stamp(LocalDate date, boolean endExclusive) {
        LocalDateTime moment = endExclusive ? date.plusDays(1).atStartOfDay() : date.atStartOfDay();
        return moment.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private static void requireRange(LocalDate start, LocalDate end) {
        if (start == null || end == null || start.isAfter(end)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid startDate/endDate range");
        }
    }

    private AnalyticsCoverageRes coverage(long paid, LocalDate start, LocalDate end) {
        String from = stamp(start, false);
        String to = stamp(end, true);
        return AnalyticsCoverageRes.builder()
                .paidInvoices(paid)
                .excludedPending(repository.countUnpaidOrdersByStatus("PENDING", from, to))
                .excludedCancelledUnpaid(repository.countUnpaidOrdersByStatus("CANCELLED", from, to))
                .softDeletedProductsAttributed(
                        repository.countSoftDeletedProductsWithPaidSales(from, to))
                .channelNote(CHANNEL_NOTE)
                .cogsNote(COGS_NOTE)
                .openingStockNote(OPENING_NOTE)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public RevenueReportRes revenue(String period, LocalDate startDate, LocalDate endDate) {
        requireRange(startDate, endDate);
        String normalized = period == null ? "DAY" : period.toUpperCase(Locale.ROOT);
        if (!List.of("DAY", "WEEK", "MONTH", "YEAR").contains(normalized)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Unsupported period");
        }
        Map<String, BigDecimal> byBucket = new LinkedHashMap<>();
        Map<String, Long> ordersByBucket = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        long orders = 0;
        for (Object[] row : repository.paidInvoicesInRange(stamp(startDate, false), stamp(endDate, true))) {
            LocalDateTime issued = (LocalDateTime) row[1];
            BigDecimal amount = row[2] == null ? BigDecimal.ZERO : new BigDecimal(row[2].toString());
            String bucket = bucketOf(normalized, issued.toLocalDate());
            byBucket.merge(bucket, amount, BigDecimal::add);
            ordersByBucket.merge(bucket, 1L, Long::sum);
            total = total.add(amount);
            orders++;
        }
        List<RevenueTimelineItem> timeline = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : byBucket.entrySet()) {
            timeline.add(RevenueTimelineItem.builder().date(entry.getKey()).revenue(entry.getValue())
                    .orders(ordersByBucket.getOrDefault(entry.getKey(), 0L)).build());
        }
        RevenueSummaryRes summary = RevenueSummaryRes.builder().totalRevenue(total).totalOrders(orders)
                .averageOrderValue(orders == 0 ? BigDecimal.ZERO
                        : total.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP))
                .totalCogs(null).grossProfit(null).build();
        return RevenueReportRes.builder().summary(summary).timeline(timeline)
                .coverage(coverage(orders, startDate, endDate)).build();
    }

    static String bucketOf(String period, LocalDate date) {
        return switch (period) {
            case "WEEK" -> date.with(java.time.DayOfWeek.MONDAY).toString();
            case "MONTH" -> date.withDayOfMonth(1).toString();
            case "YEAR" -> date.withDayOfYear(1).toString();
            default -> date.toString();
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<TopProductRes> topProducts(String type, int limit, LocalDate startDate, LocalDate endDate) {
        requireRange(startDate, endDate);
        if (limit < 1 || limit > 100) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid limit");
        }
        String normalized = type == null ? "BEST_SELLER" : type.toUpperCase(Locale.ROOT);
        if (!List.of("BEST_SELLER", "SLOW_MOVING").contains(normalized)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Unsupported type");
        }
        record Row(Long skuId, Long productId, String name, String category, String color, String size,
                String barcode, long qty, BigDecimal revenue, boolean softDeleted, long stock) {
        }
        List<Row> rows = new ArrayList<>();
        long softDeleted = 0;
        for (Object[] r : repository.productSalesInRange(stamp(startDate, false), stamp(endDate, true))) {
            boolean deleted = ((Number) r[9]).longValue() > 0;
            if (deleted) {
                softDeleted++;
            }
            rows.add(new Row(((Number) r[0]).longValue(), ((Number) r[1]).longValue(), (String) r[2],
                    (String) r[3], (String) r[4], (String) r[5], (String) r[6],
                    ((Number) r[7]).longValue(), new BigDecimal(r[8].toString()), deleted,
                    ((Number) r[10]).longValue()));
        }
        rows.sort(normalized.equals("SLOW_MOVING")
                ? Comparator.comparingLong(Row::qty).thenComparing(Row::skuId)
                : Comparator.comparingLong(Row::qty).reversed().thenComparing(Row::skuId));
        List<TopProductRes> result = new ArrayList<>();
        int rank = 1;
        for (Row row : rows.subList(0, Math.min(limit, rows.size()))) {
            if (normalized.equals("SLOW_MOVING") && row.qty() > 0) {
                continue;
            }
            result.add(TopProductRes.builder().rank(rank++).productId(row.productId()).productName(row.name())
                    .categoryName(row.category()).totalQuantitySold(row.qty()).totalRevenue(row.revenue())
                    .currentInventory(row.stock()).softDeleted(row.softDeleted()).build());
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<InventoryMovementRes> inventoryMovement(int year, int month, Long skuId, int page, int size) {
        if (month < 1 || month > 12 || page < 0 || size < 1 || size > 100) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid month/page/size");
        }
        YearMonth ym = YearMonth.of(year, month);
        String monthStamp = ym.atDay(1).atStartOfDay().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        List<Object[]> rows = repository.skuMovementInMonth(monthStamp, skuId);
        int total = rows.size();
        int fromIndex = Math.min(page * size, total);
        int toIndex = Math.min(fromIndex + size, total);
        List<InventoryMovementRes> content = new ArrayList<>();
        for (Object[] r : rows.subList(fromIndex, toIndex)) {
            content.add(InventoryMovementRes.builder().skuId(((Number) r[0]).longValue())
                    .productName((String) r[1]).color((String) r[2]).size((String) r[3])
                    .barcode((String) r[4]).openingStock(null).totalImport(null)
                    .totalSold(((Number) r[5]).longValue()).totalDamaged(null)
                    .closingStock(((Number) r[6]).longValue()).build());
        }
        int pages = total == 0 ? 0 : (total + size - 1) / size;
        return PageResponse.<InventoryMovementRes>builder().content(content).pageNumber(page).pageSize(size)
                .totalElements(total).totalPages(pages).isLast(toIndex >= total).build();
    }
}
