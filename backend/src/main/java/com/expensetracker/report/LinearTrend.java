package com.expensetracker.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Ordinary least squares fit over monthly totals, used to project the rest of the year.
 *
 * <p>Only complete months are fed in. A month still in progress would sit far below its eventual
 * total and drag the whole line down, which is the classic way a forecast like this goes wrong.
 */
record LinearTrend(double intercept, double slope) {

    /** x is the 1-based position of the month in the series, not the calendar month. */
    static LinearTrend fit(List<BigDecimal> monthlyTotals) {
        int n = monthlyTotals.size();
        if (n == 0) {
            return new LinearTrend(0, 0);
        }
        if (n == 1) {
            return new LinearTrend(monthlyTotals.getFirst().doubleValue(), 0);
        }

        double sumX = 0;
        double sumY = 0;
        double sumXy = 0;
        double sumXx = 0;

        for (int i = 0; i < n; i++) {
            double x = i + 1;
            double y = monthlyTotals.get(i).doubleValue();
            sumX += x;
            sumY += y;
            sumXy += x * y;
            sumXx += x * x;
        }

        double denominator = n * sumXx - sumX * sumX;
        if (denominator == 0) {
            return new LinearTrend(sumY / n, 0);
        }

        double slope = (n * sumXy - sumX * sumY) / denominator;
        double intercept = (sumY - slope * sumX) / n;
        return new LinearTrend(intercept, slope);
    }

    /** Money never goes negative here, so a downward line is clamped rather than allowed to invert. */
    BigDecimal predictAt(int position) {
        double value = intercept + slope * position;
        return BigDecimal.valueOf(Math.max(value, 0)).setScale(2, RoundingMode.HALF_UP);
    }

    BigDecimal monthlyChange() {
        return BigDecimal.valueOf(slope).setScale(2, RoundingMode.HALF_UP);
    }
}
