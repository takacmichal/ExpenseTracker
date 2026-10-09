package com.expensetracker.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.expensetracker.auth.CurrentUser;
import com.expensetracker.budget.BudgetRepository;
import com.expensetracker.category.dto.CategoryDtos.CategoryRequest;
import com.expensetracker.common.ConflictException;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.TransactionRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CategoryServiceTest {

    private final UUID userId = UUID.randomUUID();
    private final CategoryRepository categoryRepository = mock(CategoryRepository.class);
    private final BudgetRepository budgetRepository = mock(BudgetRepository.class);
    private final CategoryService service = service();

    private CategoryService service() {
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.requireId()).thenReturn(userId);
        return new CategoryService(
                categoryRepository,
                mock(CategoryRuleRepository.class),
                mock(TransactionRepository.class),
                budgetRepository,
                currentUser);
    }

    private Category ownedExpenseCategory() {
        Category category = category(null);
        category.setName("Potraviny");
        category.setType(TransactionType.EXPENSE);
        when(categoryRepository.findByIdAndUserId(category.getId(), userId)).thenReturn(Optional.of(category));
        return category;
    }

    @Test
    void budgetedCategoryCannotTurnIntoIncome() {
        Category category = ownedExpenseCategory();
        when(budgetRepository.existsByCategoryIdAndUserId(category.getId(), userId)).thenReturn(true);

        assertThatThrownBy(() -> service.update(
                        category.getId(), new CategoryRequest("Potraviny", null, null, TransactionType.INCOME, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("rozpočet");
        assertThat(category.getType()).isEqualTo(TransactionType.EXPENSE);
    }

    @Test
    void categoryWithoutBudgetCanTurnIntoIncome() {
        Category category = ownedExpenseCategory();
        when(budgetRepository.existsByCategoryIdAndUserId(category.getId(), userId)).thenReturn(false);

        service.update(category.getId(), new CategoryRequest("Potraviny", null, null, TransactionType.INCOME, null));

        assertThat(category.getType()).isEqualTo(TransactionType.INCOME);
    }

    @Test
    void budgetedCategoryCanStillBeRenamed() {
        Category category = ownedExpenseCategory();
        when(budgetRepository.existsByCategoryIdAndUserId(category.getId(), userId)).thenReturn(true);

        service.update(category.getId(), new CategoryRequest("Jedlo", null, null, TransactionType.EXPENSE, null));

        assertThat(category.getName()).isEqualTo("Jedlo");
    }

    private static Category category(Category parent) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setParent(parent);
        return category;
    }

    @Test
    void noParentIsNeverACycle() {
        assertThat(CategoryService.createsCycle(UUID.randomUUID(), null)).isFalse();
    }

    @Test
    void unrelatedParentIsAllowed() {
        Category root = category(null);
        Category child = category(root);
        Category other = category(null);

        assertThat(CategoryService.createsCycle(other.getId(), child)).isFalse();
    }

    @Test
    void selfAsParentIsACycle() {
        Category self = category(null);

        assertThat(CategoryService.createsCycle(self.getId(), self)).isTrue();
    }

    /** root -> child -> grandchild: making the grandchild root's parent would loop. */
    @Test
    void descendantAsParentIsACycle() {
        Category root = category(null);
        Category child = category(root);
        Category grandchild = category(child);

        assertThat(CategoryService.createsCycle(root.getId(), grandchild)).isTrue();
        assertThat(CategoryService.createsCycle(root.getId(), child)).isTrue();
    }

    @Test
    void stopsOnAPreExistingLoop() {
        Category a = category(null);
        Category b = category(a);
        a.setParent(b);

        assertThat(CategoryService.createsCycle(UUID.randomUUID(), a)).isTrue();
    }
}
