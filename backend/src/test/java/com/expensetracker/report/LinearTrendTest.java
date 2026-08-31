package com.expensetracker.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class LinearTrendTest {

    private static List<BigDecimal> series(String... values) {
        return List.of(values).stream().map(BigDecimal::new).toList();
    }

    @Test
    void flatSeriesPredictsTheSameValue() {
        LinearTrend trend = LinearTrend.fit(series("1000", "1000", "1000", "1000"));

        assertThat(trend.predictAt(5)).isEqualByComparingTo("1000.00");
        assertThat(trend.monthlyChange()).isEqualByComparingTo("0.00");
    }

    @Test
    void risingSeriesExtrapolatesUpwards() {
        LinearTrend trend = LinearTrend.fit(series("100", "200", "300", "400"));

        assertThat(trend.predictAt(5)).isEqualByComparingTo("500.00");
        assertThat(trend.predictAt(6)).isEqualByComparingTo("600.00");
        assertThat(trend.monthlyChange()).isEqualByComparingTo("100.00");
    }

    @Test
    void fallingSeriesReportsANegativeMonthlyChange() {
        LinearTrend trend = LinearTrend.fit(series("400", "300", "200", "100"));

        assertThat(trend.monthlyChange()).isEqualByComparingTo("-100.00");
    }

    /** Spending cannot go below zero, so a steep decline is clamped rather than inverted. */
    @Test
    void neverPredictsNegativeMoney() {
        LinearTrend trend = LinearTrend.fit(series("400", "300", "200", "100"));

        assertThat(trend.predictAt(9)).isEqualByComparingTo("0.00");
        assertThat(trend.predictAt(20)).isEqualByComparingTo("0.00");
    }

    @Test
    void singleMonthRepeatsThatMonth() {
        LinearTrend trend = LinearTrend.fit(series("1234.56"));

        assertThat(trend.predictAt(7)).isEqualByComparingTo("1234.56");
        assertThat(trend.monthlyChange()).isEqualByComparingTo("0.00");
    }

    @Test
    void emptySeriesPredictsNothing() {
        LinearTrend trend = LinearTrend.fit(List.of());

        assertThat(trend.predictAt(1)).isEqualByComparingTo("0.00");
    }

    /** A noisy series should still follow the overall direction rather than the last point. */
    @Test
    void fitsThroughNoiseRatherThanChasingTheLastValue() {
        LinearTrend trend = LinearTrend.fit(series("100", "500", "200", "600", "300", "700"));

        assertThat(trend.monthlyChange()).isGreaterThan(BigDecimal.ZERO);
        assertThat(trend.predictAt(7)).isBetween(new BigDecimal("400"), new BigDecimal("700"));
    }
}
