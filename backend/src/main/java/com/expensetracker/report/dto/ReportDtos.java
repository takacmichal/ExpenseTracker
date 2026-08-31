package com.expensetracker.report.dto;

import com.expensetracker.report.CategoryTotal;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ReportDtos {

    private ReportDtos() {}

    public record MonthlySummary(
            String month,
            LocalDate from,
            LocalDate to,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal balance) {}

    public record CategoryBreakdown(LocalDate from, LocalDate to, List<CategoryTotal> categories) {}

    /** One point of the year series; {@code cumulativeBalance} is the running total from January. */
    public record MonthPoint(
            int month,
            String label,
            BigDecimal income,
            BigDecimal expense,
            BigDecimal balance,
            BigDecimal cumulativeBalance,
            boolean complete) {}

    public record YearOverview(
            int year,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal balance,
            List<MonthPoint> months) {}

    public record CategoryForecast(
            String categoryName, String color, BigDecimal actualToDate, BigDecimal projectedYearEnd) {}

    public record Forecast(
            int year,
            int monthsUsed,
            BigDecimal actualIncome,
            BigDecimal actualExpense,
            BigDecimal actualBalance,
            BigDecimal projectedIncome,
            BigDecimal projectedExpense,
            BigDecimal projectedBalance,
            BigDecimal incomeMonthlyChange,
            BigDecimal expenseMonthlyChange,
            List<CategoryForecast> categories) {}
}
