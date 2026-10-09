package com.expensetracker.budget;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;

class BudgetMathTest {

    private static final YearMonth APRIL = YearMonth.of(2026, 4);

    private static BudgetMath math(String limit, String spent, YearMonth month, String today) {
        return BudgetMath.of(new BigDecimal(limit), new BigDecimal(spent), month, LocalDate.parse(today));
    }

    @Test
    void reportsRemainingAndPercentUsed() {
        BudgetMath math = math("400.00", "100.00", APRIL, "2026-05-10");

        assertThat(math.remaining()).isEqualByComparingTo("300.00");
        assertThat(math.percentUsed()).isEqualByComparingTo("25.0");
        assertThat(math.exceeded()).isFalse();
    }

    @Test
    void overspendingGoesNegativeAndPastOneHundredPercent() {
        BudgetMath math = math("200.00", "250.00", APRIL, "2026-05-10");

        assertThat(math.remaining()).isEqualByComparingTo("-50.00");
        assertThat(math.percentUsed()).isEqualByComparingTo("125.0");
        assertThat(math.exceeded()).isTrue();
    }

    @Test
    void spendingExactlyTheLimitIsNotExceeded() {
        assertThat(math("200.00", "200.00", APRIL, "2026-05-10").exceeded()).isFalse();
    }

    @Test
    void percentIsRoundedToOneDecimal() {
        assertThat(math("300.00", "100.00", APRIL, "2026-05-10").percentUsed()).isEqualByComparingTo("33.3");
    }

    /** Ten days into a thirty-day month, 100 spent extrapolates to 300. */
    @Test
    void projectsTheCurrentMonthLinearlyByElapsedDays() {
        BudgetMath math = math("400.00", "100.00", APRIL, "2026-04-10");

        assertThat(math.projected()).isEqualByComparingTo("300.00");
    }

    @Test
    void lastDayOfMonthProjectsWhatWasSpent() {
        assertThat(math("400.00", "123.45", APRIL, "2026-04-30").projected()).isEqualByComparingTo("123.45");
    }

    @Test
    void noProjectionForPastOrFutureMonths() {
        assertThat(math("400.00", "100.00", APRIL, "2026-05-01").projected()).isNull();
        assertThat(math("400.00", "0.00", APRIL, "2026-03-31").projected()).isNull();
    }

    @Test
    void nothingSpentIsZeroPercent() {
        BudgetMath math = math("400.00", "0", APRIL, "2026-04-15");

        assertThat(math.percentUsed()).isEqualByComparingTo("0.0");
        assertThat(math.projected()).isEqualByComparingTo("0.00");
        assertThat(math.remaining()).isEqualByComparingTo("400.00");
    }
}
