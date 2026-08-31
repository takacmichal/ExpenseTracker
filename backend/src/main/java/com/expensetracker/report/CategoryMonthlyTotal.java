package com.expensetracker.report;

import java.math.BigDecimal;
import java.util.UUID;

/** One month's total for one category, used to trend each category separately. */
public record CategoryMonthlyTotal(
        UUID categoryId, String categoryName, String color, int year, int month, BigDecimal total) {}
