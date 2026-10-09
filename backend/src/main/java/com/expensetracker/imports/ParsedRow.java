package com.expensetracker.imports;

import com.expensetracker.common.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One parsed CSV line. A row carrying an {@code error} is reported in the preview and skipped on import.
 *
 * <p>{@code categoryId} / {@code categoryName} are filled in by the rule matcher, so the preview shows
 * exactly the categorisation the import will apply. {@code duplicate} marks a row the target account
 * already holds; it is shown in the preview and skipped on import.
 */
public record ParsedRow(
        int lineNumber,
        LocalDate date,
        BigDecimal amount,
        String description,
        TransactionType type,
        String counterparty,
        String currency,
        String bankType,
        UUID categoryId,
        String categoryName,
        String categoryColor,
        String error,
        boolean duplicate) {

    public static ParsedRow ok(
            int lineNumber,
            LocalDate date,
            BigDecimal amount,
            String description,
            TransactionType type,
            String counterparty,
            String currency,
            String bankType) {
        return new ParsedRow(
                lineNumber, date, amount, description, type, counterparty, currency, bankType, null, null, null, null, false);
    }

    public static ParsedRow failed(int lineNumber, String error) {
        return new ParsedRow(lineNumber, null, null, null, null, null, null, null, null, null, null, error, false);
    }

    public ParsedRow withCategory(UUID id, String name, String color) {
        return new ParsedRow(
                lineNumber, date, amount, description, type, counterparty, currency, bankType, id, name, color, error, duplicate);
    }

    public ParsedRow asDuplicate() {
        return new ParsedRow(
                lineNumber, date, amount, description, type, counterparty, currency, bankType, categoryId, categoryName,
                categoryColor, error, true);
    }

    public boolean isValid() {
        return error == null;
    }
}
