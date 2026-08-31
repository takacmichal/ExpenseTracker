package com.expensetracker.report;

import com.expensetracker.auth.CurrentUser;
import com.expensetracker.common.TransactionType;
import com.expensetracker.report.dto.ReportDtos.CategoryForecast;
import com.expensetracker.report.dto.ReportDtos.Forecast;
import com.expensetracker.report.dto.ReportDtos.MonthPoint;
import com.expensetracker.report.dto.ReportDtos.YearOverview;
import com.expensetracker.transaction.TransactionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ForecastService {

    private static final Locale SK = Locale.of("sk");

    private final TransactionRepository transactionRepository;
    private final CurrentUser currentUser;

    public ForecastService(TransactionRepository transactionRepository, CurrentUser currentUser) {
        this.transactionRepository = transactionRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public YearOverview yearOverview(int year) {
        List<MonthlyTotal> totals = transactionRepository.monthlyTotals(
                currentUser.requireId(), LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));

        Map<Integer, BigDecimal> income = byMonth(totals, TransactionType.INCOME);
        Map<Integer, BigDecimal> expense = byMonth(totals, TransactionType.EXPENSE);

        int lastComplete = lastCompleteMonth(year);
        List<MonthPoint> months = new ArrayList<>();
        BigDecimal running = BigDecimal.ZERO;
        BigDecimal totalIncome = BigDecimal.ZERO;
        BigDecimal totalExpense = BigDecimal.ZERO;

        for (int month = 1; month <= 12; month++) {
            BigDecimal in = income.getOrDefault(month, BigDecimal.ZERO);
            BigDecimal out = expense.getOrDefault(month, BigDecimal.ZERO);
            BigDecimal balance = in.subtract(out);

            running = running.add(balance);
            totalIncome = totalIncome.add(in);
            totalExpense = totalExpense.add(out);

            months.add(new MonthPoint(month, monthLabel(month), in, out, balance, running, month <= lastComplete));
        }

        return new YearOverview(year, totalIncome, totalExpense, totalIncome.subtract(totalExpense), months);
    }

    /**
     * Projects the rest of the year from a least-squares line through the complete months.
     *
     * <p>The month in progress is excluded from the fit and re-estimated instead: a half-finished
     * month looks like a collapse in spending and would bend the line downwards.
     */
    @Transactional(readOnly = true)
    public Forecast forecast(int year) {
        UUID userId = currentUser.requireId();
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to = LocalDate.of(year, 12, 31);

        List<MonthlyTotal> totals = transactionRepository.monthlyTotals(userId, from, to);
        Map<Integer, BigDecimal> income = byMonth(totals, TransactionType.INCOME);
        Map<Integer, BigDecimal> expense = byMonth(totals, TransactionType.EXPENSE);

        int monthsUsed = lastCompleteMonth(year);

        BigDecimal actualIncome = sumAll(income);
        BigDecimal actualExpense = sumAll(expense);

        BigDecimal projectedIncome = project(income, monthsUsed);
        BigDecimal projectedExpense = project(expense, monthsUsed);

        LinearTrend incomeTrend = LinearTrend.fit(series(income, monthsUsed));
        LinearTrend expenseTrend = LinearTrend.fit(series(expense, monthsUsed));

        return new Forecast(
                year,
                monthsUsed,
                actualIncome,
                actualExpense,
                actualIncome.subtract(actualExpense),
                projectedIncome,
                projectedExpense,
                projectedIncome.subtract(projectedExpense),
                incomeTrend.monthlyChange(),
                expenseTrend.monthlyChange(),
                categoryForecasts(userId, from, to, monthsUsed));
    }

    private List<CategoryForecast> categoryForecasts(UUID userId, LocalDate from, LocalDate to, int monthsUsed) {
        Map<String, Map<Integer, BigDecimal>> perCategory = new LinkedHashMap<>();
        Map<String, String> colors = new LinkedHashMap<>();

        for (CategoryMonthlyTotal row : transactionRepository.categoryMonthlyTotals(
                userId, from, to, TransactionType.EXPENSE)) {
            String name = row.categoryName() == null ? "Nezaradené" : row.categoryName();
            perCategory.computeIfAbsent(name, key -> new LinkedHashMap<>()).merge(row.month(), row.total(), BigDecimal::add);
            colors.putIfAbsent(name, row.color());
        }

        return perCategory.entrySet().stream()
                .map(entry -> new CategoryForecast(
                        entry.getKey(),
                        colors.get(entry.getKey()),
                        sumAll(entry.getValue()),
                        project(entry.getValue(), monthsUsed)))
                .sorted(Comparator.comparing(CategoryForecast::projectedYearEnd).reversed())
                .toList();
    }

    /** Actuals for the complete months plus the trend's estimate for every month still to come. */
    private BigDecimal project(Map<Integer, BigDecimal> byMonth, int monthsUsed) {
        if (monthsUsed <= 0) {
            return sumAll(byMonth);
        }

        List<BigDecimal> observed = series(byMonth, monthsUsed);
        LinearTrend trend = LinearTrend.fit(observed);

        BigDecimal total = observed.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        for (int month = monthsUsed + 1; month <= 12; month++) {
            total = total.add(trend.predictAt(month));
        }
        return total;
    }

    private List<BigDecimal> series(Map<Integer, BigDecimal> byMonth, int monthsUsed) {
        List<BigDecimal> series = new ArrayList<>();
        for (int month = 1; month <= monthsUsed; month++) {
            series.add(byMonth.getOrDefault(month, BigDecimal.ZERO));
        }
        return series;
    }

    private Map<Integer, BigDecimal> byMonth(List<MonthlyTotal> totals, TransactionType type) {
        Map<Integer, BigDecimal> result = new LinkedHashMap<>();
        totals.stream()
                .filter(total -> total.type() == type)
                .forEach(total -> result.merge(total.month(), total.total(), BigDecimal::add));
        return result;
    }

    private BigDecimal sumAll(Map<Integer, BigDecimal> byMonth) {
        return byMonth.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** December of a past year is complete; the current month never is. */
    private int lastCompleteMonth(int year) {
        YearMonth now = YearMonth.now();
        if (year < now.getYear()) {
            return 12;
        }
        if (year > now.getYear()) {
            return 0;
        }
        return now.getMonthValue() - 1;
    }

    private String monthLabel(int month) {
        return YearMonth.of(2000, month).getMonth().getDisplayName(TextStyle.SHORT, SK);
    }
}
