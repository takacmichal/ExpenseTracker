package com.expensetracker.budget.dto;

import com.expensetracker.budget.Budget;
import com.expensetracker.category.Category;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class BudgetDtos {

    private BudgetDtos() {}

    /** A null {@code categoryId} is the overall budget across all expenses. */
    public record BudgetRequest(
            UUID categoryId,
            @NotNull(message = "Zadaj limit rozpočtu.")
                    @DecimalMin(value = "0.01", message = "Limit musí byť aspoň 0,01.")
                    @Digits(integer = 17, fraction = 2, message = "Limit môže mať najviac 2 desatinné miesta.")
                    BigDecimal amountLimit) {}

    public record BudgetResponse(
            UUID id, UUID categoryId, String categoryName, String categoryColor, BigDecimal amountLimit) {

        public static BudgetResponse from(Budget budget) {
            Category category = budget.getCategory();
            return new BudgetResponse(
                    budget.getId(),
                    category == null ? null : category.getId(),
                    category == null ? null : category.getName(),
                    category == null ? null : category.getColor(),
                    budget.getAmountLimit());
        }
    }

    /** {@code projectedSpend} is present only for the month in progress. */
    public record BudgetStatus(
            UUID budgetId,
            UUID categoryId,
            String categoryName,
            String categoryColor,
            BigDecimal amountLimit,
            BigDecimal spent,
            BigDecimal remaining,
            BigDecimal percentUsed,
            BigDecimal projectedSpend,
            boolean exceeded) {}

    public record BudgetStatusReport(int year, int month, boolean currentMonth, List<BudgetStatus> budgets) {}
}
