package com.expensetracker.income;

import com.expensetracker.auth.CurrentUser;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.income.dto.IncomeDtos.IncomeRequest;
import com.expensetracker.income.dto.IncomeDtos.IncomeResponse;
import com.expensetracker.transaction.TransactionRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IncomeService {

    private final IncomeRepository incomeRepository;
    private final TransactionRepository transactionRepository;
    private final CurrentUser currentUser;

    public IncomeService(
            IncomeRepository incomeRepository,
            TransactionRepository transactionRepository,
            CurrentUser currentUser) {
        this.incomeRepository = incomeRepository;
        this.transactionRepository = transactionRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<IncomeResponse> list(LocalDate from, LocalDate to) {
        UUID userId = currentUser.requireId();
        List<Income> incomes = (from == null || to == null)
                ? incomeRepository.findByUserIdOrderByDateDesc(userId)
                : incomeRepository.findByUserIdAndDateBetweenOrderByDateDesc(userId, from, to);

        return incomes.stream().map(IncomeResponse::from).toList();
    }

    @Transactional
    public IncomeResponse create(IncomeRequest request) {
        Income income = new Income();
        income.setUser(currentUser.requireReference());
        apply(income, request);
        return IncomeResponse.from(incomeRepository.save(income));
    }

    @Transactional
    public IncomeResponse update(UUID id, IncomeRequest request) {
        Income income = requireOwned(id);
        apply(income, request);
        return IncomeResponse.from(income);
    }

    @Transactional
    public void delete(UUID id) {
        incomeRepository.delete(requireOwned(id));
    }

    private void apply(Income income, IncomeRequest request) {
        income.setDate(request.date());
        income.setNetAmount(request.netAmount());
        income.setGrossAmount(request.grossAmount());
        income.setEmployer(request.employer());
        income.setNote(request.note());
        income.setTransaction(
                request.transactionId() == null
                        ? null
                        : transactionRepository
                                .findByIdAndUserId(request.transactionId(), currentUser.requireId())
                                .orElseThrow(() -> new NotFoundException("Transakcia", request.transactionId())));
    }

    private Income requireOwned(UUID id) {
        return incomeRepository
                .findByIdAndUserId(id, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Príjem", id));
    }
}
