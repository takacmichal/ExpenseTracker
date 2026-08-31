package com.expensetracker.category;

import com.expensetracker.common.TextNormalizer;
import com.expensetracker.common.TransactionType;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Picks a category for a transaction using the user's rules.
 *
 * <p>Shared by the import preview and the import itself, so what the preview shows is exactly what
 * gets saved.
 */
@Service
public class CategoryMatcher {

    private final CategoryRuleRepository categoryRuleRepository;

    public CategoryMatcher(CategoryRuleRepository categoryRuleRepository) {
        this.categoryRuleRepository = categoryRuleRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryRule> rulesFor(UUID userId) {
        return categoryRuleRepository.findByUserIdAndActiveTrueOrderByPriorityDesc(userId);
    }

    /**
     * Matches against the merchant description first and the bank's own transaction type second, so
     * a generic rule like {@code sepa platba} can catch transfers that carry only a person's name.
     *
     * <p>Only categories facing the same direction as the transaction are eligible: money arriving
     * must never land in an expense category. That also lets one pattern serve both directions —
     * {@code sepa platba} maps to "Odoslané prevody" going out and "Prijaté prevody" coming in.
     *
     * <p>Highest priority wins; on a tie the longer pattern wins, since a longer pattern is the more
     * specific one.
     */
    public Optional<Category> match(
            String description, String bankType, TransactionType direction, List<CategoryRule> rules) {

        String merchant = TextNormalizer.fold(description);
        String type = TextNormalizer.fold(bankType);

        if (merchant.isEmpty() && type.isEmpty()) {
            return Optional.empty();
        }

        List<CategoryRule> eligible = rules.stream()
                .filter(rule -> direction == null || rule.getCategory().getType() == direction)
                .toList();

        return firstMatch(merchant, eligible).or(() -> firstMatch(type, eligible));
    }

    private Optional<Category> firstMatch(String haystack, List<CategoryRule> rules) {
        if (haystack.isEmpty()) {
            return Optional.empty();
        }

        return rules.stream()
                .filter(rule -> {
                    String needle = TextNormalizer.fold(rule.getMatchPattern());
                    return !needle.isEmpty() && haystack.contains(needle);
                })
                .max(Comparator.comparingInt(CategoryRule::getPriority)
                        .thenComparingInt(rule -> rule.getMatchPattern().length()))
                .map(CategoryRule::getCategory);
    }
}
