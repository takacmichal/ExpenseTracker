package com.expensetracker.category;

import com.expensetracker.category.dto.CategoryDtos.CategoryRuleRequest;
import com.expensetracker.category.dto.CategoryDtos.CategoryRuleResponse;
import com.expensetracker.category.dto.CategoryDtos.RuleTestRequest;
import com.expensetracker.category.dto.CategoryDtos.RuleTestResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/category-rules")
@Tag(name = "Category rules", description = "Patterns that assign categories to transactions")
public class CategoryRuleController {

    private final CategoryRuleService categoryRuleService;

    public CategoryRuleController(CategoryRuleService categoryRuleService) {
        this.categoryRuleService = categoryRuleService;
    }

    @GetMapping
    @Operation(summary = "List all rules, highest priority first")
    public List<CategoryRuleResponse> list() {
        return categoryRuleService.list();
    }

    @PostMapping
    @Operation(summary = "Create a rule")
    public ResponseEntity<CategoryRuleResponse> create(@Valid @RequestBody CategoryRuleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryRuleService.create(request));
    }

    @PostMapping("/test")
    @Operation(summary = "Count the transactions a pattern would match, with a sample of up to 10")
    public RuleTestResponse test(@Valid @RequestBody RuleTestRequest request) {
        return categoryRuleService.test(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a rule")
    public CategoryRuleResponse update(@PathVariable UUID id, @Valid @RequestBody CategoryRuleRequest request) {
        return categoryRuleService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a rule")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        categoryRuleService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
