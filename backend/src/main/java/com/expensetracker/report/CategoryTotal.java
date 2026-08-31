package com.expensetracker.report;

import com.expensetracker.common.TransactionType;
import java.math.BigDecimal;
import java.util.UUID;

/** Projection populated directly by the aggregate query in TransactionRepository. */
public record CategoryTotal(
        UUID categoryId,
        String categoryName,
        String color,
        String icon,
        TransactionType type,
        BigDecimal total,
        long transactionCount) {}
