package com.expensetracker.transaction.dto;

import com.expensetracker.common.TransactionSource;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.Transaction;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public final class TransactionDtos {

    private TransactionDtos() {}

    public record TransactionRequest(
            @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
            @NotNull LocalDate date,
            @Size(max = 255) String description,
            @NotNull TransactionType type,
            @NotNull UUID accountId,
            UUID categoryId) {}

    public record TransactionResponse(
            UUID id,
            BigDecimal amount,
            LocalDate date,
            String description,
            TransactionType type,
            TransactionSource source,
            UUID accountId,
            String accountName,
            UUID categoryId,
            String categoryName,
            String categoryColor) {

        public static TransactionResponse from(Transaction transaction) {
            var category = transaction.getCategory();
            return new TransactionResponse(
                    transaction.getId(),
                    transaction.getAmount(),
                    transaction.getDate(),
                    transaction.getDescription(),
                    transaction.getType(),
                    transaction.getSource(),
                    transaction.getAccount().getId(),
                    transaction.getAccount().getName(),
                    category == null ? null : category.getId(),
                    category == null ? null : category.getName(),
                    category == null ? null : category.getColor());
        }
    }
}
