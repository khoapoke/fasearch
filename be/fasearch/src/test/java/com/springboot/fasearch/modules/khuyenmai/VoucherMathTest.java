package com.springboot.fasearch.modules.khuyenmai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.modules.khuyenmai.service.VoucherMath;

class VoucherMathTest {
    @Test
    void percentageAllocatesExactCentsAndCapsAtEligibleMerchandise() {
        var result = VoucherMath.calculate(List.of(
                new VoucherMath.Line(2L, 7L, new BigDecimal("0.05")),
                new VoucherMath.Line(1L, 7L, new BigDecimal("0.05")),
                new VoucherMath.Line(3L, 8L, new BigDecimal("90.00"))),
                Set.of(7L), "PHAN_TRAM", new BigDecimal("50"));

        assertEquals(new BigDecimal("0.05"), result.discount());
        assertEquals(new BigDecimal("0.10"), result.eligibleSubtotal());
        assertEquals(new BigDecimal("0.03"), result.discountBySku().get(1L));
        assertEquals(new BigDecimal("0.02"), result.discountBySku().get(2L));
        assertEquals(new BigDecimal("0.00"), result.discountBySku().get(3L));
    }

    @Test
    void fixedDiscountIsCappedAndBadPercentRejected() {
        var result = VoucherMath.calculate(List.of(new VoucherMath.Line(1L, 1L, new BigDecimal("4.00"))),
                Set.of(), "SO_TIEN", new BigDecimal("10.00"));
        assertEquals(new BigDecimal("4.00"), result.discount());
        assertThrows(IllegalArgumentException.class, () -> VoucherMath.calculate(
                List.of(new VoucherMath.Line(1L, 1L, BigDecimal.TEN)), Set.of(), "PHAN_TRAM", new BigDecimal("101")));
    }
}
