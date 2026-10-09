package com.expensetracker.transaction.dto;

import com.expensetracker.common.TransactionSource;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.Transaction;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class TransactionDtos {

    private TransactionDtos() {}

    public record TransactionRequest(
            @NotNull(message = "Zadaj sumu.") @DecimalMin(value = "0.01", message = "Suma musí byť aspoň 0,01.")
                    BigDecimal amount,
            @NotNull(message = "Zadaj dátum.") LocalDate date,
            @Size(max = 255, message = "Popis môže mať najviac 255 znakov.") String description,
            @NotNull(message = "Vyber typ transakcie.") TransactionType type,
            @NotNull(message = "Vyber účet.") UUID accountId,
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

    public enum BulkAction {
        SET_CATEGORY,
        DELETE
    }

    /** For {@code SET_CATEGORY} a null {@code categoryId} clears the category. */
    public record BulkRequest(
            @NotEmpty(message = "Vyber aspoň jednu transakciu.")
                    @Size(max = 1000, message = "Naraz možno upraviť najviac 1000 transakcií.")
                    List<@NotNull(message = "Zoznam transakcií obsahuje prázdnu položku.") UUID> ids,
            @NotNull(message = "Vyber akciu.") BulkAction action,
            UUID categoryId) {}

    public record BulkResult(int affected) {}
}
