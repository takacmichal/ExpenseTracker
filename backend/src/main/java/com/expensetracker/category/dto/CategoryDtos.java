package com.expensetracker.category.dto;

import com.expensetracker.category.Category;
import com.expensetracker.category.CategoryRule;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionResponse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public final class CategoryDtos {

    private CategoryDtos() {}

    public record CategoryRequest(
            @NotBlank(message = "Zadaj názov kategórie.")
                    @Size(max = 255, message = "Názov môže mať najviac 255 znakov.")
                    String name,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Farba musí byť v tvare #RRGGBB, napríklad #3B82F6.") String color,
            @Size(max = 255, message = "Ikona môže mať najviac 255 znakov.") String icon,
            @NotNull(message = "Vyber typ kategórie.") TransactionType type,
            UUID parentId) {}

    public record CategoryResponse(
            UUID id, String name, String color, String icon, TransactionType type, UUID parentId, String parentName) {

        public static CategoryResponse from(Category category) {
            Category parent = category.getParent();
            return new CategoryResponse(
                    category.getId(),
                    category.getName(),
                    category.getColor(),
                    category.getIcon(),
                    category.getType(),
                    parent == null ? null : parent.getId(),
                    parent == null ? null : parent.getName());
        }
    }

    public record CategoryRuleRequest(
            @NotBlank(message = "Zadaj vzor pravidla.")
                    @Size(max = 255, message = "Vzor môže mať najviac 255 znakov.")
                    String pattern,
            @NotNull(message = "Vyber kategóriu.") UUID categoryId,
            Integer priority,
            Boolean active) {}

    public record CategoryRuleResponse(
            UUID id,
            String pattern,
            int priority,
            boolean active,
            UUID categoryId,
            String categoryName,
            String categoryColor,
            TransactionType categoryType) {

        public static CategoryRuleResponse from(CategoryRule rule) {
            Category category = rule.getCategory();
            return new CategoryRuleResponse(
                    rule.getId(),
                    rule.getMatchPattern(),
                    rule.getPriority(),
                    rule.isActive(),
                    category.getId(),
                    category.getName(),
                    category.getColor(),
                    category.getType());
        }
    }

    /** {@code type} narrows the dry run to one direction, as the matcher does for a real rule. */
    public record RuleTestRequest(
            @NotBlank(message = "Zadaj vzor pravidla.")
                    @Size(max = 255, message = "Vzor môže mať najviac 255 znakov.")
                    String pattern,
            TransactionType type) {}

    public record RuleTestResponse(String pattern, int matchCount, List<TransactionResponse> sample) {}
}
