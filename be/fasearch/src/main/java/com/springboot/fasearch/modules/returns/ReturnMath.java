package com.springboot.fasearch.modules.returns;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Cumulative allocation makes split requests add up exactly to the original line snapshot. */
public final class ReturnMath {
    private ReturnMath() {}
    public static BigDecimal share(BigDecimal total, int before, int quantity, int purchased) {
        if (purchased <= 0 || before < 0 || quantity < 0 || (long) before + quantity > purchased)
            throw new IllegalArgumentException("Số lượng trả không hợp lệ.");
        int scale = Math.max(0, Math.min(2, total.stripTrailingZeros().scale()));
        return total.multiply(BigDecimal.valueOf(before + quantity)).divide(BigDecimal.valueOf(purchased), scale, RoundingMode.DOWN)
                .subtract(total.multiply(BigDecimal.valueOf(before)).divide(BigDecimal.valueOf(purchased), scale, RoundingMode.DOWN));
    }
    public static int points(int total, BigDecimal previous, BigDecimal current, BigDecimal base) {
        if (total <= 0 || base.signum() <= 0) return 0;
        return BigDecimal.valueOf(total).multiply(previous.add(current).min(base)).divide(base, 0, RoundingMode.DOWN).intValueExact()
                - BigDecimal.valueOf(total).multiply(previous.min(base)).divide(base, 0, RoundingMode.DOWN).intValueExact();
    }
}
