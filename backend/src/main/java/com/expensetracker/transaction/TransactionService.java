package com.expensetracker.transaction;

import com.expensetracker.account.AccountRepository;
import com.expensetracker.auth.CurrentUser;
import com.expensetracker.category.CategoryMatcher;
import com.expensetracker.category.CategoryRepository;
import com.expensetracker.category.CategoryTree;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.common.TransactionSource;
import com.expensetracker.common.TransactionType;
import com.expensetracker.category.Category;
import com.expensetracker.transaction.dto.TransactionDtos.BulkRequest;
import com.expensetracker.transaction.dto.TransactionDtos.BulkResult;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionRequest;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionResponse;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
            LocalDate from,
            LocalDate to,
            UUID categoryId,
            boolean includeSubcategories,
            UUID accountId,
            TransactionType type,
            String query,
            Pageable pageable) {
        UUID userId = currentUser.requireId();
        var specification = TransactionSpecifications.filter(
                userId, from, to, categoryFilter(userId, categoryId, includeSubcategories), accountId, type, query);

        return transactionRepository
                .findAll(specification, withTieBreakers(pageable))
                .map(TransactionResponse::from);
    }

    /**
     * Many transactions share a date (a whole import lands on a few days), so sorting by date alone
     * lets rows swap between pages. Newest-created first, then id, makes every page deterministic
     * while the caller's own sort still decides first.
     */
    static Pageable withTieBreakers(Pageable pageable) {
        Sort sort = pageable.getSort();
        if (sort.getOrderFor("createdAt") == null) {
            sort = sort.and(Sort.by(Sort.Order.desc("createdAt")));
        }
        if (sort.getOrderFor("id") == null) {
            sort = sort.and(Sort.by(Sort.Order.asc("id")));
        }
        return pageable.isPaged()
                ? PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort)
                : Pageable.unpaged(sort);
    }

    /** Null when not filtering by category; otherwise the category, plus its subtree on request. */
    private Collection<UUID> categoryFilter(UUID userId, UUID categoryId, boolean includeSubcategories) {
        if (categoryId == null) {
            return null;
        }
        if (!includeSubcategories) {
            return List.of(categoryId);
        }
        return CategoryTree.of(categoryRepository.findByUserIdOrderByNameAsc(userId)).subtree(categoryId);
    }

    /** Same filters as {@link #search}, unpaged, newest first. */
    @Transactional(readOnly = true)
    public byte[] exportCsv(
            LocalDate from,
            LocalDate to,
            UUID categoryId,
            boolean includeSubcategories,
            UUID accountId,
            TransactionType type,
            String query) {
        UUID userId = currentUser.requireId();
        var specification = TransactionSpecifications.filter(
                userId, from, to, categoryFilter(userId, categoryId, includeSubcategories), accountId, type, query);

        return TransactionCsvWriter.write(transactionRepository.findAll(
                specification,
                Sort.by(Sort.Order.desc("date"), Sort.Order.desc("createdAt"), Sort.Order.asc("id"))));
    }

    /**
     * Applies one action to many transactions. All-or-nothing: if any id is unknown or belongs to
     * someone else the whole request fails, so a stale selection cannot half-apply.
     */
    @Transactional
    public BulkResult bulk(BulkRequest request) {
        UUID userId = currentUser.requireId();
        Set<UUID> ids = new LinkedHashSet<>(request.ids());

        List<Transaction> transactions = transactionRepository.findByUserIdAndIdIn(userId, ids);
        if (transactions.size() != ids.size()) {
            Set<UUID> found = new HashSet<>();
            transactions.forEach(transaction -> found.add(transaction.getId()));
            UUID missing = ids.stream().filter(id -> !found.contains(id)).findFirst().orElseThrow();
            throw new NotFoundException("Transakcia", missing);
        }

        switch (request.action()) {
            case SET_CATEGORY -> {
                Category category = request.categoryId() == null
                        ? null
                        : categoryRepository
                                .findByIdAndUserId(request.categoryId(), userId)
                                .orElseThrow(() -> new NotFoundException("Kategória", request.categoryId()));
                if (category != null
                        && transactions.stream().anyMatch(transaction -> transaction.getType() != category.getType())) {
                    throw new IllegalArgumentException(category.getType() == TransactionType.EXPENSE
                            ? "Výdavkovú kategóriu nemožno priradiť príjmom. Vyber len výdavky."
                            : "Príjmovú kategóriu nemožno priradiť výdavkom. Vyber len príjmy.");
                }
                transactions.forEach(transaction -> transaction.setCategory(category));
            }
            case DELETE -> transactionRepository.deleteAll(transactions);
        }
        return new BulkResult(transactions.size());
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
                .orElseThrow(() -> new NotFoundException("Účet", request.accountId())));
        Category category = request.categoryId() == null
                ? null
                : categoryRepository
                        .findByIdAndUserId(request.categoryId(), userId)
                        .orElseThrow(() -> new NotFoundException("Kategória", request.categoryId()));
        if (category != null && category.getType() != request.type()) {
            throw new IllegalArgumentException(request.type() == TransactionType.EXPENSE
                    ? "Výdavku možno priradiť len výdavkovú kategóriu."
                    : "Príjmu možno priradiť len príjmovú kategóriu.");
        }
        transaction.setCategory(category);
    }

    private Transaction requireOwned(UUID id) {
        return transactionRepository
                .findByIdAndUserId(id, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Transakcia", id));
    }
}
