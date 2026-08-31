package com.expensetracker.report;

import com.expensetracker.auth.CurrentUser;
import com.expensetracker.common.TransactionType;
import com.expensetracker.report.dto.ReportDtos.CategoryBreakdown;
import com.expensetracker.report.dto.ReportDtos.MonthlySummary;
import com.expensetracker.transaction.TransactionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

    private final TransactionRepository transactionRepository;
    private final CurrentUser currentUser;

    public ReportService(TransactionRepository transactionRepository, CurrentUser currentUser) {
        this.transactionRepository = transactionRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public MonthlySummary summary(YearMonth month) {
        UUID userId = currentUser.requireId();
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();

        BigDecimal income = transactionRepository.sumByType(userId, TransactionType.INCOME, from, to);
        BigDecimal expense = transactionRepository.sumByType(userId, TransactionType.EXPENSE, from, to);

        return new MonthlySummary(month.toString(), from, to, income, expense, income.subtract(expense));
    }

    @Transactional(readOnly = true)
    public CategoryBreakdown byCategory(LocalDate from, LocalDate to, TransactionType type) {
        return new CategoryBreakdown(
                from, to, transactionRepository.totalsByCategory(currentUser.requireId(), from, to, type));
    }
}
