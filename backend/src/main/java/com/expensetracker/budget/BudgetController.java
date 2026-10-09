package com.expensetracker.budget;

import com.expensetracker.budget.dto.BudgetDtos.BudgetRequest;
import com.expensetracker.budget.dto.BudgetDtos.BudgetResponse;
import com.expensetracker.budget.dto.BudgetDtos.BudgetStatusReport;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.YearMonth;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/budgets")
@Tag(name = "Budgets", description = "Monthly spending limits per expense category or overall")
public class BudgetController {

    private final BudgetService budgetService;
    private final Clock clock;

    public BudgetController(BudgetService budgetService, Clock clock) {
        this.budgetService = budgetService;
        this.clock = clock;
    }

    @GetMapping
    @Operation(summary = "List all budgets, the overall one first")
    public List<BudgetResponse> list() {
        return budgetService.list();
    }

    @GetMapping("/status")
    @Operation(summary = "Spending against each budget for one month, with a month-end projection for the current one")
    public BudgetStatusReport status(
            @Parameter(description = "Defaults to the current year") @RequestParam(required = false) Integer year,
            @Parameter(description = "1-12; defaults to the current month") @RequestParam(required = false)
                    Integer month) {
        YearMonth now = YearMonth.now(clock);
        if (month != null && (month < 1 || month > 12)) {
            throw new IllegalArgumentException("Mesiac musí byť od 1 do 12.");
        }
        if (year != null && (year < 1900 || year > 9999)) {
            throw new IllegalArgumentException("Rok je mimo povoleného rozsahu.");
        }
        return budgetService.status(YearMonth.of(
                year == null ? now.getYear() : year, month == null ? now.getMonthValue() : month));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single budget")
    public BudgetResponse get(@PathVariable UUID id) {
        return budgetService.get(id);
    }

    @PostMapping
    @Operation(summary = "Create a budget; omit categoryId for the overall budget")
    public ResponseEntity<BudgetResponse> create(@Valid @RequestBody BudgetRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(budgetService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a budget")
    public BudgetResponse update(@PathVariable UUID id, @Valid @RequestBody BudgetRequest request) {
        return budgetService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a budget")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        budgetService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
