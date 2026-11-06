package com.expensetracker.budget;

import com.expensetracker.auth.CurrentUser;
import com.expensetracker.budget.dto.BudgetDtos.BudgetRequest;
import com.expensetracker.budget.dto.BudgetDtos.BudgetResponse;
import com.expensetracker.budget.dto.BudgetDtos.BudgetStatus;
import com.expensetracker.budget.dto.BudgetDtos.BudgetStatusReport;
import com.expensetracker.category.Category;
import com.expensetracker.category.CategoryRepository;
import com.expensetracker.category.CategoryTree;
import com.expensetracker.common.ConflictException;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.common.TransactionType;
import com.expensetracker.report.CategoryTotal;
import com.expensetracker.transaction.TransactionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BudgetService {

    /** Overall budget first, then categories alphabetically. */
    private static final Comparator<Budget> DISPLAY_ORDER = Comparator.comparing(
            (Budget budget) -> budget.getCategory() == null ? "" : budget.getCategory().getName(),
            String.CASE_INSENSITIVE_ORDER);

    private final BudgetRepository budgetRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final CurrentUser currentUser;
    private final Clock clock;

    public BudgetService(
            BudgetRepository budgetRepository,
            CategoryRepository categoryRepository,
            TransactionRepository transactionRepository,
            CurrentUser currentUser,
            Clock clock) {
        this.budgetRepository = budgetRepository;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<BudgetResponse> list() {
        return budgetRepository.findByUserId(currentUser.requireId()).stream()
                .sorted(DISPLAY_ORDER)
                .map(BudgetResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public BudgetResponse get(UUID id) {
        return BudgetResponse.from(requireOwned(id));
    }

    @Transactional
    public BudgetResponse create(BudgetRequest request) {
        Budget budget = new Budget();
        budget.setUser(currentUser.requireReference());
        apply(budget, request);
        return BudgetResponse.from(budgetRepository.save(budget));
    }

    @Transactional
    public BudgetResponse update(UUID id, BudgetRequest request) {
        Budget budget = requireOwned(id);
        apply(budget, request);
        return BudgetResponse.from(budget);
    }

    @Transactional
    public void delete(UUID id) {
        budgetRepository.delete(requireOwned(id));
    }

    /**
     * Spending against every budget for one month. A category budget also counts its subcategories,
     * so a limit on "Doprava" still holds when fuel is filed under a child category.
     */
    @Transactional(readOnly = true)
    public BudgetStatusReport status(YearMonth month) {
        UUID userId = currentUser.requireId();
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        LocalDate today = LocalDate.now(clock);

        Map<UUID, BigDecimal> spentByCategory = new HashMap<>();
        BigDecimal spentOverall = BigDecimal.ZERO;
        for (CategoryTotal total : transactionRepository.totalsByCategory(userId, from, to, TransactionType.EXPENSE)) {
            spentOverall = spentOverall.add(total.total());
            if (total.categoryId() != null) {
                spentByCategory.merge(total.categoryId(), total.total(), BigDecimal::add);
            }
        }

        CategoryTree tree = CategoryTree.of(categoryRepository.findByUserIdOrderByNameAsc(userId));

        List<BudgetStatus> statuses = new ArrayList<>();
        for (Budget budget : budgetRepository.findByUserId(userId).stream().sorted(DISPLAY_ORDER).toList()) {
            Category category = budget.getCategory();
            BigDecimal spent = category == null
                    ? spentOverall
                    : tree.subtree(category.getId()).stream()
                            .map(id -> spentByCategory.getOrDefault(id, BigDecimal.ZERO))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
            BudgetMath math = BudgetMath.of(budget.getAmountLimit(), spent, month, today);

            statuses.add(new BudgetStatus(
                    budget.getId(),
                    category == null ? null : category.getId(),
                    category == null ? null : category.getName(),
                    category == null ? null : category.getColor(),
                    budget.getAmountLimit(),
                    spent,
                    math.remaining(),
                    math.percentUsed(),
                    math.projected(),
                    math.exceeded()));
        }

        return new BudgetStatusReport(
                month.getYear(), month.getMonthValue(), YearMonth.from(today).equals(month), statuses);
    }

    private void apply(Budget budget, BudgetRequest request) {
        UUID userId = currentUser.requireId();
        Category category = null;

        if (request.categoryId() != null) {
            category = categoryRepository
                    .findByIdAndUserId(request.categoryId(), userId)
                    .orElseThrow(() -> new NotFoundException("Kategória", request.categoryId()));
            if (category.getType() != TransactionType.EXPENSE) {
                throw new IllegalArgumentException("Rozpočet možno nastaviť len pre výdavkové kategórie.");
            }
        }

        Optional<Budget> existing = request.categoryId() == null
                ? budgetRepository.findByUserIdAndCategoryIsNull(userId)
                : budgetRepository.findByUserIdAndCategoryId(userId, request.categoryId());
        if (existing.isPresent() && !existing.get().getId().equals(budget.getId())) {
            throw new ConflictException(request.categoryId() == null
                    ? "Celkový rozpočet už existuje."
                    : "Rozpočet pre túto kategóriu už existuje.");
        }

        budget.setCategory(category);
        budget.setAmountLimit(request.amountLimit().setScale(2, RoundingMode.UNNECESSARY));
    }

    private Budget requireOwned(UUID id) {
        return budgetRepository
                .findByIdAndUserId(id, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Rozpočet", id));
    }
}
