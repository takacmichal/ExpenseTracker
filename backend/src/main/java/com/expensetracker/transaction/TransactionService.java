package com.expensetracker.transaction;

import com.expensetracker.account.AccountRepository;
import com.expensetracker.auth.CurrentUser;
import com.expensetracker.category.CategoryMatcher;
import com.expensetracker.category.CategoryRepository;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.common.TransactionSource;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionRequest;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionResponse;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final CategoryMatcher categoryMatcher;
    private final CurrentUser currentUser;

    public TransactionService(
            TransactionRepository transactionRepository,
            AccountRepository accountRepository,
            CategoryRepository categoryRepository,
            CategoryMatcher categoryMatcher,
            CurrentUser currentUser) {
        this.transactionRepository = transactionRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.categoryMatcher = categoryMatcher;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public Page<TransactionResponse> search(
            LocalDate from, LocalDate to, UUID categoryId, UUID accountId, TransactionType type, Pageable pageable) {
        var specification = TransactionSpecifications.filter(
                currentUser.requireId(), from, to, categoryId, accountId, type);

        return transactionRepository.findAll(specification, pageable).map(TransactionResponse::from);
    }

    @Transactional(readOnly = true)
    public TransactionResponse get(UUID id) {
        return TransactionResponse.from(requireOwned(id));
    }

    @Transactional
    public TransactionResponse create(TransactionRequest request) {
        Transaction transaction = new Transaction();
        transaction.setUser(currentUser.requireReference());
        transaction.setSource(TransactionSource.MANUAL);
        apply(transaction, request);
        return TransactionResponse.from(transactionRepository.save(transaction));
    }

    @Transactional
    public TransactionResponse update(UUID id, TransactionRequest request) {
        Transaction transaction = requireOwned(id);
        apply(transaction, request);
        return TransactionResponse.from(transaction);
    }

    /**
     * Applies the current rules to everything still uncategorised. Run it after adding rules, or
     * after importing with rules that did not exist yet.
     */
    @Transactional
    public int categoriseUncategorised() {
        UUID userId = currentUser.requireId();
        var rules = categoryMatcher.rulesFor(userId);
        if (rules.isEmpty()) {
            return 0;
        }

        int updated = 0;
        for (Transaction transaction : transactionRepository.findByUserIdAndCategoryIsNull(userId)) {
            var match = categoryMatcher.match(
                    transaction.getDescription(), transaction.getBankType(), transaction.getType(), rules);
            if (match.isPresent()) {
                transaction.setCategory(match.get());
                updated++;
            }
        }
        return updated;
    }

    @Transactional
    public void delete(UUID id) {
        transactionRepository.delete(requireOwned(id));
    }

    private void apply(Transaction transaction, TransactionRequest request) {
        UUID userId = currentUser.requireId();

        transaction.setAmount(request.amount());
        transaction.setDate(request.date());
        transaction.setDescription(request.description());
        transaction.setType(request.type());
        transaction.setAccount(accountRepository
                .findByIdAndUserId(request.accountId(), userId)
                .orElseThrow(() -> new NotFoundException("Account", request.accountId())));
        transaction.setCategory(
                request.categoryId() == null
                        ? null
                        : categoryRepository
                                .findByIdAndUserId(request.categoryId(), userId)
                                .orElseThrow(() -> new NotFoundException("Category", request.categoryId())));
    }

    private Transaction requireOwned(UUID id) {
        return transactionRepository
                .findByIdAndUserId(id, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Transaction", id));
    }
}
