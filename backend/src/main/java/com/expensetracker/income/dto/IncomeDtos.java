package com.expensetracker.income.dto;

import com.expensetracker.income.Income;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public final class IncomeDtos {

    private IncomeDtos() {}

    public record IncomeRequest(
            @NotNull(message = "Zadaj dátum.") LocalDate date,
            @NotNull(message = "Zadaj čistú sumu.")
                    @DecimalMin(value = "0.01", message = "Čistá suma musí byť aspoň 0,01.")
                    BigDecimal netAmount,
            @DecimalMin(value = "0.01", message = "Hrubá suma musí byť aspoň 0,01.") BigDecimal grossAmount,
            @Size(max = 255, message = "Zamestnávateľ môže mať najviac 255 znakov.") String employer,
            @Size(max = 255, message = "Poznámka môže mať najviac 255 znakov.") String note,
            UUID transactionId) {}

    public record IncomeResponse(
            UUID id,
            LocalDate date,
            BigDecimal netAmount,
            BigDecimal grossAmount,
            String employer,
            String note,
            UUID transactionId) {

        public static IncomeResponse from(Income income) {
            return new IncomeResponse(
                    income.getId(),
                    income.getDate(),
                    income.getNetAmount(),
                    income.getGrossAmount(),
                    income.getEmployer(),
                    income.getNote(),
                    income.getTransaction() == null ? null : income.getTransaction().getId());
        }
    }
}
