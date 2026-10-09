package com.expensetracker.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.expensetracker.account.Account;
import com.expensetracker.account.AccountRepository;
import com.expensetracker.auth.CurrentUser;
import com.expensetracker.category.Category;
import com.expensetracker.category.CategoryMatcher;
import com.expensetracker.category.CategoryRepository;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.dto.TransactionDtos.BulkAction;
import com.expensetracker.transaction.dto.TransactionDtos.BulkRequest;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

class TransactionServiceTest {

    private final UUID userId = UUID.randomUUID();

    private TransactionRepository transactionRepository;
    private CategoryRepository categoryRepository;
    private AccountRepository accountRepository;
    private TransactionService service;

    @BeforeEach
    void setUp() {
        transactionRepository = mock(TransactionRepository.class);
        categoryRepository = mock(CategoryRepository.class);
        accountRepository = mock(AccountRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.requireId()).thenReturn(userId);

        service = new TransactionService(
                transactionRepository,
                accountRepository,
                categoryRepository,
                mock(CategoryMatcher.class),
                currentUser);
    }

    private static Transaction transaction(UUID id) {
        return transaction(id, TransactionType.EXPENSE);
    }

    private static Transaction transaction(UUID id, TransactionType type) {
        Transaction transaction = new Transaction();
        transaction.setId(id);
        transaction.setType(type);
        return transaction;
    }

    private static Category category(TransactionType type) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setType(type);
        return category;
    }

    /** Someone else's id is indistinguishable from a missing one, and nothing is touched. */
    @Test
    void bulkRejectsIdsTheUserDoesNotOwn() {
        UUID mine = UUID.randomUUID();
        UUID foreign = UUID.randomUUID();
        when(transactionRepository.findByUserIdAndIdIn(eq(userId), anyCollection()))
                .thenReturn(List.of(transaction(mine)));

        assertThatThrownBy(() -> service.bulk(new BulkRequest(List.of(mine, foreign), BulkAction.DELETE, null)))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining(foreign.toString());

        verify(transactionRepository, never()).deleteAll(any());
    }

    @Test
    void bulkDeleteRemovesAllOwnedTransactions() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        List<Transaction> owned = List.of(transaction(first), transaction(second));
        when(transactionRepository.findByUserIdAndIdIn(eq(userId), anyCollection())).thenReturn(owned);

        var result = service.bulk(new BulkRequest(List.of(first, second, first), BulkAction.DELETE, null));

        assertThat(result.affected()).isEqualTo(2);
        verify(transactionRepository).deleteAll(owned);
    }

    @Test
    void bulkSetCategoryLooksTheCategoryUpForTheCurrentUser() {
        UUID id = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        Transaction owned = transaction(id);
        Category category = category(TransactionType.EXPENSE);
        when(transactionRepository.findByUserIdAndIdIn(eq(userId), anyCollection())).thenReturn(List.of(owned));
        when(categoryRepository.findByIdAndUserId(categoryId, userId)).thenReturn(Optional.of(category));

        var result = service.bulk(new BulkRequest(List.of(id), BulkAction.SET_CATEGORY, categoryId));

        assertThat(result.affected()).isEqualTo(1);
        assertThat(owned.getCategory()).isSameAs(category);
    }

    @Test
    void bulkSetCategoryRejectsAForeignCategory() {
        UUID id = UUID.randomUUID();
        UUID foreignCategory = UUID.randomUUID();
        Transaction owned = transaction(id);
        when(transactionRepository.findByUserIdAndIdIn(eq(userId), anyCollection())).thenReturn(List.of(owned));
        when(categoryRepository.findByIdAndUserId(foreignCategory, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.bulk(new BulkRequest(List.of(id), BulkAction.SET_CATEGORY, foreignCategory)))
                .isInstanceOf(NotFoundException.class);
        assertThat(owned.getCategory()).isNull();
    }

    /** One income in the selection is enough to refuse an expense category for all of them. */
    @Test
    void bulkSetCategoryRejectsACategoryOfTheOtherDirection() {
        Transaction expense = transaction(UUID.randomUUID(), TransactionType.EXPENSE);
        Transaction income = transaction(UUID.randomUUID(), TransactionType.INCOME);
        Category category = category(TransactionType.EXPENSE);
        when(transactionRepository.findByUserIdAndIdIn(eq(userId), anyCollection()))
                .thenReturn(List.of(expense, income));
        when(categoryRepository.findByIdAndUserId(category.getId(), userId)).thenReturn(Optional.of(category));

        assertThatThrownBy(() -> service.bulk(new BulkRequest(
                        List.of(expense.getId(), income.getId()), BulkAction.SET_CATEGORY, category.getId())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("príjmom");
        assertThat(expense.getCategory()).isNull();
        assertThat(income.getCategory()).isNull();
    }

    @Test
    void bulkSetCategoryToNoneIgnoresDirection() {
        Transaction income = transaction(UUID.randomUUID(), TransactionType.INCOME);
        income.setCategory(category(TransactionType.INCOME));
        when(transactionRepository.findByUserIdAndIdIn(eq(userId), anyCollection())).thenReturn(List.of(income));

        service.bulk(new BulkRequest(List.of(income.getId()), BulkAction.SET_CATEGORY, null));

        assertThat(income.getCategory()).isNull();
    }

    @Test
    void createRejectsACategoryOfTheOtherDirection() {
        UUID accountId = UUID.randomUUID();
        Category incomeCategory = category(TransactionType.INCOME);
        when(accountRepository.findByIdAndUserId(accountId, userId)).thenReturn(Optional.of(new Account()));
        when(categoryRepository.findByIdAndUserId(incomeCategory.getId(), userId))
                .thenReturn(Optional.of(incomeCategory));

        var request = new TransactionRequest(
                new BigDecimal("12.50"),
                LocalDate.of(2026, 10, 1),
                "Lidl",
                TransactionType.EXPENSE,
                accountId,
                incomeCategory.getId());

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("výdavkovú kategóriu");
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void createAcceptsACategoryOfTheSameDirection() {
        UUID accountId = UUID.randomUUID();
        Category expenseCategory = category(TransactionType.EXPENSE);
        when(accountRepository.findByIdAndUserId(accountId, userId)).thenReturn(Optional.of(new Account()));
        when(categoryRepository.findByIdAndUserId(expenseCategory.getId(), userId))
                .thenReturn(Optional.of(expenseCategory));
        when(transactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create(new TransactionRequest(
                new BigDecimal("12.50"),
                LocalDate.of(2026, 10, 1),
                "Lidl",
                TransactionType.EXPENSE,
                accountId,
                expenseCategory.getId()));

        assertThat(response.categoryId()).isEqualTo(expenseCategory.getId());
    }

    @Test
    void tieBreakersFollowTheCallersSort() {
        Pageable pageable = PageRequest.of(2, 25, Sort.by(Sort.Order.asc("amount")));

        Pageable result = TransactionService.withTieBreakers(pageable);

        assertThat(result.getPageNumber()).isEqualTo(2);
        assertThat(result.getPageSize()).isEqualTo(25);
        assertThat(result.getSort().toList())
                .containsExactly(Sort.Order.asc("amount"), Sort.Order.desc("createdAt"), Sort.Order.asc("id"));
    }

    @Test
    void tieBreakersDoNotDuplicateAnExplicitSort() {
        Pageable pageable = PageRequest.of(0, 10, Sort.by(Sort.Order.asc("createdAt")));

        assertThat(TransactionService.withTieBreakers(pageable).getSort().toList())
                .containsExactly(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));
    }
}
