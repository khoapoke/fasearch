package com.springboot.fasearch.modules.khuyenmai.service;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class VoucherMath {
    private VoucherMath() {}

    public record Line(Long skuId, Long productId, BigDecimal subtotal) {}
    public record Result(Map<Long, BigDecimal> discountBySku, BigDecimal discount, BigDecimal eligibleSubtotal) {}

    public static Result calculate(List<Line> lines, Set<Long> productScope, String type, BigDecimal value) {
        if (value == null || value.signum() <= 0 || !("PHAN_TRAM".equals(type) || "SO_TIEN".equals(type) || "FREE_SHIP".equals(type))) {
            throw new IllegalArgumentException("Invalid voucher discount");
        }
        if ("PHAN_TRAM".equals(type) && value.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("Voucher percentage exceeds 100");
        }
        List<Line> eligible = new ArrayList<>();
        BigDecimal eligibleSubtotal = BigDecimal.ZERO;
        for (Line line : lines) {
            if (line == null || line.skuId() == null || line.subtotal() == null || line.subtotal().signum() < 0) {
                throw new IllegalArgumentException("Invalid priced line");
            }
            if (productScope == null || productScope.isEmpty() || productScope.contains(line.productId())) {
                eligible.add(line);
                eligibleSubtotal = eligibleSubtotal.add(line.subtotal());
            }
        }
        eligible.sort(Comparator.comparing(Line::skuId));
        eligibleSubtotal = eligibleSubtotal.setScale(2, RoundingMode.HALF_UP);
        if (eligible.isEmpty() || eligibleSubtotal.signum() == 0) {
            throw new IllegalArgumentException("Voucher has no eligible merchandise");
        }
        BigDecimal discount = "FREE_SHIP".equals(type) ? BigDecimal.ZERO.setScale(2) : "PHAN_TRAM".equals(type)
                ? eligibleSubtotal.multiply(value).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : value.min(eligibleSubtotal).setScale(2, RoundingMode.HALF_UP);
        Map<Long, BigDecimal> bySku = new LinkedHashMap<>();
        lines.stream().sorted(Comparator.comparing(Line::skuId))
                .forEach(line -> bySku.put(line.skuId(), BigDecimal.ZERO.setScale(2)));
        bySku.putAll(allocate(eligible, discount, eligibleSubtotal));
        return new Result(bySku, discount, eligibleSubtotal);
    }

    private record Share(Line line, long cents, BigInteger remainder) {}

    private static Map<Long, BigDecimal> allocate(List<Line> lines, BigDecimal discount, BigDecimal total) {
        long discountCents = discount.movePointRight(2).longValueExact();
        long totalCents = total.movePointRight(2).longValueExact();
        List<Share> shares = new ArrayList<>();
        long assigned = 0;
        for (Line line : lines) {
            long lineCents = line.subtotal().setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
            BigInteger[] quotient = BigInteger.valueOf(discountCents).multiply(BigInteger.valueOf(lineCents))
                    .divideAndRemainder(BigInteger.valueOf(totalCents));
            long cents = quotient[0].longValueExact();
            shares.add(new Share(line, cents, quotient[1]));
            assigned += cents;
        }
        long remaining = discountCents - assigned;
        shares.sort(Comparator.comparing(Share::remainder).reversed().thenComparing(s -> s.line().skuId()));
        Map<Long, Long> allocated = new LinkedHashMap<>();
        for (Share share : shares) allocated.put(share.line().skuId(), share.cents());
        for (int i = 0; i < remaining; i++) {
            Long sku = shares.get(i).line().skuId();
            allocated.put(sku, allocated.get(sku) + 1);
        }
        Map<Long, BigDecimal> result = new LinkedHashMap<>();
        lines.stream().sorted(Comparator.comparing(Line::skuId)).forEach(line ->
                result.put(line.skuId(), BigDecimal.valueOf(allocated.get(line.skuId()), 2)));
        return result;
    }
}
