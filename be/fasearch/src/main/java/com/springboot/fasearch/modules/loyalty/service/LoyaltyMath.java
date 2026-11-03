package com.springboot.fasearch.modules.loyalty.service;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class LoyaltyMath {
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private LoyaltyMath() {}

    public record Line(Long skuId, BigDecimal remainingAmount) {}

    public static int allowed(int availablePoints, boolean openingRecorded, boolean policyEnabled,
            BigDecimal remainingMerchandise, BigDecimal currencyPerPoint) {
        if (availablePoints < 0 || remainingMerchandise == null || remainingMerchandise.signum() < 0) {
            throw new IllegalArgumentException("Invalid available points or remaining merchandise");
        }
        if (!openingRecorded || !policyEnabled) return 0;
        if (currencyPerPoint == null || currencyPerPoint.signum() <= 0) {
            throw new IllegalArgumentException("Redemption value must be positive");
        }
        long merchandiseCap = money(remainingMerchandise).divide(money(currencyPerPoint), 0, RoundingMode.DOWN).longValueExact();
        return (int) Math.min(availablePoints, merchandiseCap);
    }

    public static BigDecimal discount(int points, BigDecimal currencyPerPoint) {
        if (points < 0 || currencyPerPoint == null || currencyPerPoint.signum() <= 0) {
            throw new IllegalArgumentException("Invalid points or redemption value");
        }
        return money(currencyPerPoint).multiply(BigDecimal.valueOf(points)).setScale(2, RoundingMode.UNNECESSARY);
    }

    public static Map<Long, BigDecimal> allocate(List<Line> lines, BigDecimal totalDiscount) {
        BigDecimal total = money(totalDiscount);
        if (total.signum() < 0) throw new IllegalArgumentException("Discount cannot be negative");
        List<Line> ordered = new ArrayList<>(lines == null ? List.of() : lines);
        if (ordered.stream().anyMatch(line -> line == null)) {
            throw new IllegalArgumentException("Invalid allocation line");
        }
        ordered.sort(Comparator.comparing(Line::skuId, Comparator.nullsFirst(Long::compareTo)));
        Map<Long, BigDecimal> out = new LinkedHashMap<>();
        BigInteger totalWeight = BigInteger.ZERO;
        List<BigInteger> weights = new ArrayList<>(ordered.size());
        Long previousSku = null;
        for (Line line : ordered) {
            if (line == null || line.skuId() == null || line.remainingAmount() == null
                    || line.remainingAmount().signum() < 0 || line.skuId().equals(previousSku)) {
                throw new IllegalArgumentException("Invalid or duplicate allocation line");
            }
            BigInteger weight = money(line.remainingAmount()).movePointRight(2).toBigIntegerExact();
            weights.add(weight);
            totalWeight = totalWeight.add(weight);
            previousSku = line.skuId();
            out.put(line.skuId(), BigDecimal.ZERO.setScale(2));
        }
        if (total.signum() == 0) return out;
        BigInteger totalMinor = total.movePointRight(2).toBigIntegerExact();
        if (totalWeight.signum() == 0 || totalMinor.compareTo(totalWeight) > 0) {
            throw new IllegalArgumentException("Discount exceeds allocation weights");
        }

        record Share(Long skuId, BigInteger floorMinor, BigInteger remainder) {}
        List<Share> shares = new ArrayList<>(ordered.size());
        BigInteger allocated = BigInteger.ZERO;
        for (int i = 0; i < ordered.size(); i++) {
            BigInteger numerator = totalMinor.multiply(weights.get(i));
            BigInteger[] division = numerator.divideAndRemainder(totalWeight);
            shares.add(new Share(ordered.get(i).skuId(), division[0], division[1]));
            allocated = allocated.add(division[0]);
        }
        int remainingCents = totalMinor.subtract(allocated).intValueExact();
        shares.sort(Comparator.comparing(Share::remainder).reversed().thenComparing(Share::skuId));
        Map<Long, BigInteger> extra = new TreeMap<>();
        for (int i = 0; i < remainingCents; i++) {
            extra.merge(shares.get(i).skuId(), BigInteger.ONE, BigInteger::add);
        }
        for (Share share : shares) {
            out.put(share.skuId(), new BigDecimal(share.floorMinor().add(
                    extra.getOrDefault(share.skuId(), BigInteger.ZERO)), 2));
        }
        return out;
    }

    public static int earnedPoints(BigDecimal actualPaid, BigDecimal currencyPerPoint) {
        if (actualPaid == null || actualPaid.signum() < 0 || currencyPerPoint == null
                || currencyPerPoint.signum() <= 0) {
            throw new IllegalArgumentException("Invalid paid amount or earning rate");
        }
        return money(actualPaid).divide(money(currencyPerPoint), 0, RoundingMode.DOWN).intValueExact();
    }

    private static BigDecimal money(BigDecimal amount) {
        if (amount == null) throw new IllegalArgumentException("Money is required");
        return amount.setScale(2, RoundingMode.UNNECESSARY);
    }
}
