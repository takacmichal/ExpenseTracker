package com.expensetracker.category.dto;

import com.expensetracker.category.Category;
import com.expensetracker.common.TransactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class CategoryDtos {

    private CategoryDtos() {}

    public record CategoryRequest(
            @NotBlank @Size(max = 255) String name,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Color must be a hex value such as #3B82F6") String color,
            @Size(max = 255) String icon,
            @NotNull TransactionType type,
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
}
