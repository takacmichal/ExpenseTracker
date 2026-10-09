package com.expensetracker.category;

import com.expensetracker.auth.CurrentUser;
import com.expensetracker.budget.BudgetRepository;
import com.expensetracker.category.dto.CategoryDtos.CategoryRequest;
import com.expensetracker.category.dto.CategoryDtos.CategoryResponse;
import com.expensetracker.common.ConflictException;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.TransactionRepository;
import com.expensetracker.user.User;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final CategoryRuleRepository categoryRuleRepository;
    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final CurrentUser currentUser;

    public CategoryService(
            CategoryRepository categoryRepository,
            CategoryRuleRepository categoryRuleRepository,
            TransactionRepository transactionRepository,
            BudgetRepository budgetRepository,
            CurrentUser currentUser) {
        this.categoryRepository = categoryRepository;
        this.categoryRuleRepository = categoryRuleRepository;
        this.transactionRepository = transactionRepository;
        this.budgetRepository = budgetRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> list() {
        return categoryRepository.findByUserIdOrderByNameAsc(currentUser.requireId()).stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse get(UUID id) {
        return CategoryResponse.from(requireOwned(id));
    }

    /**
     * Adds the starter set for the current user. Existing names are left alone, so calling this
     * twice is safe and a user who renamed something will not get a duplicate back.
     */
    @Transactional
    public List<CategoryResponse> createDefaults() {
        return createDefaultsFor(currentUser.requireReference());
    }

    /** Same as {@link #createDefaults()} but usable before a security context exists, e.g. at sign-up. */
    @Transactional
    public List<CategoryResponse> createDefaultsFor(User owner) {
        Set<String> existing = categoryRepository.findByUserIdOrderByNameAsc(owner.getId()).stream()
                .map(category -> category.getName().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        List<Category> created = DefaultCategories.ALL.stream()
                .filter(definition -> !existing.contains(definition.name().toLowerCase(Locale.ROOT)))
                .map(definition -> {
                    Category category = new Category();
                    category.setUser(owner);
                    category.setName(definition.name());
                    category.setColor(definition.color());
                    category.setIcon(definition.icon());
                    category.setType(definition.type());
                    return category;
                })
                .toList();

        List<CategoryResponse> saved = categoryRepository.saveAll(created).stream()
                .map(CategoryResponse::from)
                .toList();

        createDefaultRulesFor(owner);

        return saved;
    }

    /**
     * Seeds the merchant rules, resolving each one against the user's categories by name. Rules
     * whose category is missing, or whose pattern the user already has, are skipped.
     */
    private void createDefaultRulesFor(User owner) {
        Map<String, Category> categoriesByName = categoryRepository.findByUserIdOrderByNameAsc(owner.getId()).stream()
                .collect(Collectors.toMap(
                        category -> category.getName().toLowerCase(Locale.ROOT),
                        category -> category,
                        (first, second) -> first));

        // A pattern may legitimately exist twice, once per direction, so identity is pattern + category.
        Set<String> existingRules = categoryRuleRepository.findByUserId(owner.getId()).stream()
                .map(rule -> ruleKey(rule.getMatchPattern(), rule.getCategory().getName()))
                .collect(Collectors.toSet());

        List<CategoryRule> rules = DefaultCategoryRules.ALL.stream()
                .filter(definition -> !existingRules.contains(ruleKey(definition.pattern(), definition.categoryName())))
                .map(definition -> {
                    Category category = categoriesByName.get(definition.categoryName().toLowerCase(Locale.ROOT));
                    if (category == null) {
                        return null;
                    }
                    CategoryRule rule = new CategoryRule();
                    rule.setUser(owner);
                    rule.setCategory(category);
                    rule.setMatchPattern(definition.pattern());
                    rule.setPriority(definition.priority());
                    rule.setActive(true);
                    return rule;
                })
                .filter(java.util.Objects::nonNull)
                .toList();

        categoryRuleRepository.saveAll(rules);
    }

    private String ruleKey(String pattern, String categoryName) {
        return pattern.toLowerCase(Locale.ROOT) + "\u0000" + categoryName.toLowerCase(Locale.ROOT);
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        Category category = new Category();
        category.setUser(currentUser.requireReference());
        apply(category, request);
        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse update(UUID id, CategoryRequest request) {
        Category category = requireOwned(id);
        if (id.equals(request.parentId())) {
            throw new ConflictException("Kategória nemôže byť nadradená sama sebe.");
        }
        apply(category, request);
        return CategoryResponse.from(category);
    }

    @Transactional
    public void delete(UUID id) {
        Category category = requireOwned(id);
        if (transactionRepository.existsByCategoryId(id)) {
            throw new ConflictException("Kategóriu nemožno zmazať, pretože ju ešte používajú transakcie.");
        }
        if (categoryRepository.existsByParentId(id)) {
            throw new ConflictException("Kategóriu nemožno zmazať, pretože má podkategórie.");
        }
        categoryRepository.delete(category);
    }

    private void apply(Category category, CategoryRequest request) {
        Category parent = request.parentId() == null ? null : requireOwned(request.parentId());
        if (category.getId() != null && createsCycle(category.getId(), parent)) {
            throw new ConflictException("Kategóriu nemožno presunúť pod jej vlastnú podkategóriu.");
        }
        // Budgets only make sense for expenses (BudgetService enforces it on create), so a budgeted
        // category must not quietly turn into an income one.
        if (category.getId() != null
                && category.getType() == TransactionType.EXPENSE
                && request.type() != TransactionType.EXPENSE
                && budgetRepository.existsByCategoryIdAndUserId(category.getId(), currentUser.requireId())) {
            throw new ConflictException("Kategória má rozpočet, najprv ho zmaž.");
        }
        category.setName(request.name());
        category.setColor(request.color());
        category.setIcon(request.icon());
        category.setType(request.type());
        category.setParent(parent);
    }

    /**
     * True when {@code categoryId} is {@code newParent} itself or one of its ancestors, i.e. the move
     * would close a loop. The visited set stops the walk on a loop that somehow already exists.
     */
    static boolean createsCycle(UUID categoryId, Category newParent) {
        Set<UUID> visited = new HashSet<>();
        for (Category ancestor = newParent; ancestor != null; ancestor = ancestor.getParent()) {
            if (categoryId.equals(ancestor.getId()) || !visited.add(ancestor.getId())) {
                return true;
            }
        }
        return false;
    }

    private Category requireOwned(UUID id) {
        return categoryRepository
                .findByIdAndUserId(id, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Kategória", id));
    }
}
