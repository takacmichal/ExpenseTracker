package com.expensetracker.report;

import com.expensetracker.common.TransactionType;
import com.expensetracker.report.dto.ReportDtos.CategoryBreakdown;
import com.expensetracker.report.dto.ReportDtos.Forecast;
import com.expensetracker.report.dto.ReportDtos.MonthlySummary;
import com.expensetracker.report.dto.ReportDtos.YearOverview;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.time.YearMonth;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Reports", description = "Monthly and per-category aggregates")
public class ReportController {

    private final ReportService reportService;
    private final ForecastService forecastService;

    public ReportController(ReportService reportService, ForecastService forecastService) {
        this.reportService = reportService;
        this.forecastService = forecastService;
    }

    @GetMapping("/summary")
    @Operation(summary = "Income, expense and balance totals for one month")
    public MonthlySummary summary(
            @Parameter(description = "Month in YYYY-MM format; defaults to the current month", example = "2026-08")
                    @RequestParam(required = false)
                    @DateTimeFormat(pattern = "yyyy-MM")
                    YearMonth month) {
        return reportService.summary(month == null ? YearMonth.now() : month);
    }

    @GetMapping("/year")
    @Operation(summary = "Month-by-month income, expense and running balance for one year")
    public YearOverview year(@RequestParam(required = false) Integer year) {
        return forecastService.yearOverview(year == null ? YearMonth.now().getYear() : year);
    }

    @GetMapping("/forecast")
    @Operation(summary = "Year-end projection from a linear trend through the complete months")
    public Forecast forecast(@RequestParam(required = false) Integer year) {
        return forecastService.forecast(year == null ? YearMonth.now().getYear() : year);
    }

    @GetMapping("/by-category")
    @Operation(summary = "Totals grouped by category for a date range")
    public CategoryBreakdown byCategory(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) TransactionType type) {
        YearMonth currentMonth = YearMonth.now();
        return reportService.byCategory(
                from == null ? currentMonth.atDay(1) : from, to == null ? currentMonth.atEndOfMonth() : to, type);
    }
}
