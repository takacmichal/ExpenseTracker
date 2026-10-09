package com.expensetracker.category;

import static org.assertj.core.api.Assertions.assertThat;

import static com.expensetracker.common.TransactionType.EXPENSE;

import com.expensetracker.common.TransactionType;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CategoryMatcherTest {

    private final CategoryMatcher matcher = new CategoryMatcher(null);

    private static Category category(String name) {
        Category category = new Category();
        category.setName(name);
        category.setType(TransactionType.EXPENSE);
        return category;
    }

    private static CategoryRule rule(String pattern, Category category, int priority) {
        CategoryRule rule = new CategoryRule();
        rule.setMatchPattern(pattern);
        rule.setCategory(category);
        rule.setPriority(priority);
        rule.setActive(true);
        return rule;
    }

    @Test
    void matchesRegardlessOfCaseAndDiacritics() {
        Category groceries = category("Potraviny");
        List<CategoryRule> rules = List.of(rule("kosice", groceries, 10));

        assertThat(matcher.match("Kaufland KOŠICE", null, EXPENSE, rules)).contains(groceries);
        assertThat(matcher.match("kaufland košice", null, EXPENSE, rules)).contains(groceries);
        assertThat(matcher.match("KAUFLAND KOSICE", null, EXPENSE, rules)).contains(groceries);
    }

    @Test
    void matchesBothSpellingsOfTheSameMerchant() {
        Category groceries = category("Potraviny");
        List<CategoryRule> rules = List.of(rule("kaufland", groceries, 10));

        assertThat(matcher.match("KAUFLAND 2420,KE,TORYSKA", null, EXPENSE, rules)).contains(groceries);
        assertThat(matcher.match("Kaufland SK 1930, KE", null, EXPENSE, rules)).contains(groceries);
    }

    /** A fuel station also sells food, so the transport rule has to win. */
    @Test
    void higherPriorityWins() {
        Category transport = category("Doprava");
        Category groceries = category("Potraviny");
        List<CategoryRule> rules = List.of(rule("shell", transport, 20), rule("shop", groceries, 10));

        assertThat(matcher.match("SHELL SHOP 8258", null, EXPENSE, rules)).contains(transport);
    }

    @Test
    void longerPatternWinsWhenPriorityIsEqual() {
        Category food = category("Reštaurácie a kaviarne");
        Category transport = category("Doprava");
        List<CategoryRule> rules = List.of(rule("bolt", transport, 10), rule("bolt.eu food", food, 10));

        assertThat(matcher.match("BOLT.EU FOOD 12345", null, EXPENSE, rules)).contains(food);
        assertThat(matcher.match("BOLT.EU RIDE 999", null, EXPENSE, rules)).contains(transport);
    }

    @Test
    void inactiveRulesAreNeverPassedIn() {
        Category groceries = category("Potraviny");
        CategoryRule inactive = rule("lidl", groceries, 10);
        inactive.setActive(false);

        // The repository filters these out; matching an empty rule set must simply miss.
        assertThat(matcher.match("Lidl Kosice", null, EXPENSE, List.of())).isEmpty();
    }

    @Test
    void returnsEmptyWhenNothingMatches() {
        List<CategoryRule> rules = List.of(rule("kaufland", category("Potraviny"), 10));

        assertThat(matcher.match("NYX*FSBsro", null, EXPENSE, rules)).isEmpty();
        assertThat(matcher.match(null, null, EXPENSE, rules)).isEqualTo(Optional.empty());
        assertThat(matcher.match("   ", null, EXPENSE, rules)).isEmpty();
    }

    /** Money arriving must never land in an expense category. */
    @Test
    void neverAssignsACategoryFacingTheWrongWay() {
        Category outgoing = category("Odoslané prevody");
        Category incoming = new Category();
        incoming.setName("Prijaté prevody");
        incoming.setType(TransactionType.INCOME);

        List<CategoryRule> rules = List.of(rule("sepa platba", outgoing, 1), rule("sepa platba", incoming, 1));

        assertThat(matcher.match(null, "SEPA platba", TransactionType.EXPENSE, rules))
                .contains(outgoing);
        assertThat(matcher.match(null, "SEPA platba", TransactionType.INCOME, rules))
                .contains(incoming);
    }

    /** A transfer carries only a person's name, so the bank's own type is the only signal left. */
    @Test
    void fallsBackToBankTypeWhenTheMerchantIsUnknown() {
        Category transfers = category("Odoslané prevody");
        List<CategoryRule> rules = List.of(rule("sepa platba", transfers, 1));

        assertThat(matcher.match("Majirská Karin", "SEPA platba", EXPENSE, rules))
                .contains(transfers);
    }

    /** The merchant is the stronger signal, so a type rule must not override it. */
    @Test
    void merchantBeatsBankTypeEvenAtHigherTypePriority() {
        Category groceries = category("Potraviny");
        Category other = category("Ostatné výdavky");
        List<CategoryRule> rules = List.of(rule("kaufland", groceries, 10), rule("platba kartou", other, 99));

        assertThat(matcher.match("KAUFLAND 2420", "Platba kartou", EXPENSE, rules))
                .contains(groceries);
    }

    @Test
    void ignoresBlankPattern() {
        List<CategoryRule> rules = List.of(rule("   ", category("Potraviny"), 10));

        assertThat(matcher.match("čokoľvek", null, EXPENSE, rules)).isEmpty();
    }

    @Test
    void singlePatternMatchesDescriptionOrBankTypeWithoutAccents() {
        assertThat(CategoryMatcher.matches("kosice", "Kaufland KOŠICE", null)).isTrue();
        assertThat(CategoryMatcher.matches("sepa platba", "Ján Novák", "SEPA platba")).isTrue();
        assertThat(CategoryMatcher.matches("lidl", "Kaufland", "Platba kartou")).isFalse();
        assertThat(CategoryMatcher.matches("   ", "anything", null)).isFalse();
    }
}
