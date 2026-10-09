package com.expensetracker.category;

import com.expensetracker.auth.CurrentUser;
import com.expensetracker.category.dto.CategoryDtos.CategoryRuleRequest;
import com.expensetracker.category.dto.CategoryDtos.CategoryRuleResponse;
import com.expensetracker.category.dto.CategoryDtos.RuleTestRequest;
import com.expensetracker.category.dto.CategoryDtos.RuleTestResponse;
import com.expensetracker.common.ConflictException;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.common.TextNormalizer;
import com.expensetracker.transaction.Transaction;
import com.expensetracker.transaction.TransactionRepository;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryRuleService {

    private static final int TEST_SAMPLE_SIZE = 10;

    /** A dry run only needs a representative count; bounding it keeps a huge history from loading whole. */
    static final int TEST_SCAN_LIMIT = 5000;

    private final CategoryRuleRepository categoryRuleRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final CurrentUser currentUser;

    public CategoryRuleService(
            CategoryRuleRepository categoryRuleRepository,
            CategoryRepository categoryRepository,
            TransactionRepository transactionRepository,
            CurrentUser currentUser) {
        this.categoryRuleRepository = categoryRuleRepository;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<CategoryRuleResponse> list() {
        return categoryRuleRepository.findByUserIdOrderByPriorityDescMatchPatternAsc(currentUser.requireId()).stream()
                .map(CategoryRuleResponse::from)
                .toList();
    }

    @Transactional
    public CategoryRuleResponse create(CategoryRuleRequest request) {
        CategoryRule rule = new CategoryRule();
        rule.setUser(currentUser.requireReference());
        apply(rule, request);
        return CategoryRuleResponse.from(categoryRuleRepository.save(rule));
    }

    @Transactional
    public CategoryRuleResponse update(UUID id, CategoryRuleRequest request) {
        CategoryRule rule = requireOwned(id);
        apply(rule, request);
        return CategoryRuleResponse.from(rule);
    }

    @Transactional
    public void delete(UUID id) {
        categoryRuleRepository.delete(requireOwned(id));
    }

    /**
     * Dry run of a pattern over the user's transactions, so a rule can be checked before it is saved.
     * Uses {@link CategoryMatcher#matches}, the same test the real categorisation applies. Only the
     * {@value #TEST_SCAN_LIMIT} most recent transactions are scanned, so the count is capped there.
     */
    @Transactional(readOnly = true)
    public RuleTestResponse test(RuleTestRequest request) {
        requireUsablePattern(request.pattern());

        UUID userId = currentUser.requireId();
        Specification<Transaction> owned = (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
        List<Transaction> recent = transactionRepository.findBy(owned, query -> query.sortBy(
                        Sort.by(Sort.Order.desc("date"), Sort.Order.desc("createdAt")))
                .limit(TEST_SCAN_LIMIT)
                .all());

        List<Transaction> matched = recent.stream()
                .filter(transaction -> request.type() == null || transaction.getType() == request.type())
                .filter(transaction -> CategoryMatcher.matches(
                        request.pattern(), transaction.getDescription(), transaction.getBankType()))
                .toList();

        return new RuleTestResponse(
                request.pattern(),
                matched.size(),
                matched.stream().limit(TEST_SAMPLE_SIZE).map(TransactionResponse::from).toList());
    }

    private void apply(CategoryRule rule, CategoryRuleRequest request) {
        UUID userId = currentUser.requireId();
        String pattern = request.pattern().trim();
        requireUsablePattern(pattern);

        Category category = categoryRepository
                .findByIdAndUserId(request.categoryId(), userId)
                .orElseThrow(() -> new NotFoundException("Kategória", request.categoryId()));

        // Same identity as the default-rule seeding: one pattern may map to two categories (one per direction).
        String folded = TextNormalizer.fold(pattern);
        boolean duplicate = categoryRuleRepository.findByUserId(userId).stream()
                .anyMatch(existing -> !existing.getId().equals(rule.getId())
                        && existing.getCategory().getId().equals(category.getId())
                        && TextNormalizer.fold(existing.getMatchPattern()).equals(folded));
        if (duplicate) {
            throw new ConflictException("Pravidlo s týmto vzorom pre túto kategóriu už existuje.");
        }

        rule.setMatchPattern(pattern);
        rule.setCategory(category);
        rule.setPriority(request.priority() == null ? 0 : request.priority());
        rule.setActive(request.active() == null || request.active());
    }

    /** A pattern of only spaces or accents folds to nothing and would match every transaction. */
    private void requireUsablePattern(String pattern) {
        if (TextNormalizer.fold(pattern).isEmpty()) {
            throw new IllegalArgumentException("Vzor nesmie byť prázdny.");
        }
    }

    private CategoryRule requireOwned(UUID id) {
        return categoryRuleRepository
                .findByIdAndUserId(id, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Pravidlo kategórie", id));
    }
}
