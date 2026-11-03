package com.springboot.fasearch.modules.loyalty.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

class LoyaltyMathTest {

    @Test
    void allowanceRequiresOpeningAndEnabledPolicyAndCapsByMerchandise() {
        assertThat(LoyaltyMath.allowed(20, false, true, bd("9000"), bd("1000"))).isZero();
        assertThat(LoyaltyMath.allowed(20, true, false, bd("9000"), bd("1000"))).isZero();
        assertThat(LoyaltyMath.allowed(20, true, true, bd("999.99"), bd("1000"))).isZero();
        assertThat(LoyaltyMath.allowed(20, true, true, bd("9999.99"), bd("1000"))).isEqualTo(9);
        assertThat(LoyaltyMath.allowed(3, true, true, bd("9000"), bd("1000"))).isEqualTo(3);
    }

    @Test
    void allocatesCurrencyByLargestRemainderWithSkuTieBreak() {
        var amounts = LoyaltyMath.allocate(List.of(
                new LoyaltyMath.Line(9L, bd("10001.01")),
                new LoyaltyMath.Line(2L, bd("10001.01"))), bd("10001.01"));
        assertThat(amounts.get(2L)).isEqualByComparingTo("5000.51");
        assertThat(amounts.get(9L)).isEqualByComparingTo("5000.50");
        assertThat(amounts.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("10001.01");
    }

    @Test
    void rejectsDuplicateSkuNegativeOrExcessAllocation() {
        assertThatIllegalArgumentException().isThrownBy(() -> LoyaltyMath.allocate(List.of(
                new LoyaltyMath.Line(1L, bd("3.00")), new LoyaltyMath.Line(1L, bd("4.00"))), bd("1.00")));
        assertThatIllegalArgumentException().isThrownBy(() -> LoyaltyMath.allocate(
                List.of(new LoyaltyMath.Line(1L, bd("1.00"))), bd("1.01")));
        assertThatIllegalArgumentException().isThrownBy(() -> LoyaltyMath.allowed(0, true, true, bd("10"), bd("0")));
    }

    @Test
    void parsePointsAcceptsOnlyNonnegativeWholeSignedIntegers() {
        assertThat(LoyaltyService.parsePoints(new BigDecimal("4.00"))).isEqualTo(4);
        for (String invalid : List.of("-1", "1.5", "2147483648")) {
            assertThatThrownBy(() -> LoyaltyService.parsePoints(new BigDecimal(invalid)))
                    .isInstanceOfSatisfying(AppException.class, error ->
                            assertThat(error.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
        }
    }

    @Test
    void earningFloorsActualPaidAndRejectsOverflow() {
        assertThat(LoyaltyMath.earnedPoints(bd("199999.99"), bd("100000.00"))).isEqualTo(1);
        assertThat(LoyaltyMath.earnedPoints(bd("99999.99"), bd("100000.00"))).isZero();
        assertThatThrownBy(() -> LoyaltyMath.earnedPoints(bd("214748364800000"), bd("1")))
                .isInstanceOf(ArithmeticException.class);
    }

    private static BigDecimal bd(String value) { return new BigDecimal(value); }
}
