package com.expensetracker.budget;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * The arithmetic behind a budget's status, kept free of Spring so it can be tested directly.
 *
 * <p>{@code projected} is a straight-line extrapolation of spending so far to the end of the month.
 * It is only produced for the month in progress: a finished month needs no projection, and a future
 * one has nothing to extrapolate from.
 */
record BudgetMath(BigDecimal remaining, BigDecimal percentUsed, BigDecimal projected, boolean exceeded) {

    static BudgetMath of(BigDecimal limit, BigDecimal spent, YearMonth month, LocalDate today) {
        BigDecimal remaining = limit.subtract(spent).setScale(2, RoundingMode.HALF_UP);
        BigDecimal percentUsed = limit.signum() == 0
                ? BigDecimal.ZERO
                : spent.multiply(BigDecimal.valueOf(100)).divide(limit, 1, RoundingMode.HALF_UP);

        BigDecimal projected = null;
        if (YearMonth.from(today).equals(month)) {
            int elapsed = today.getDayOfMonth();
            projected = spent.multiply(BigDecimal.valueOf(month.lengthOfMonth()))
                    .divide(BigDecimal.valueOf(elapsed), 2, RoundingMode.HALF_UP);
        }

        return new BudgetMath(remaining, percentUsed, projected, spent.compareTo(limit) > 0);
    }
}
