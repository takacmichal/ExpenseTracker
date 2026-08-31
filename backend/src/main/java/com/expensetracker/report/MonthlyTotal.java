package com.expensetracker.report;

import com.expensetracker.common.TransactionType;
import java.math.BigDecimal;

/** One month's total for one direction, straight from the aggregate query. */
public record MonthlyTotal(int year, int month, TransactionType type, BigDecimal total) {}
