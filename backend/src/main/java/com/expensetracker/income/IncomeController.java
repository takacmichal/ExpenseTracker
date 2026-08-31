package com.expensetracker.income;

import com.expensetracker.income.dto.IncomeDtos.IncomeRequest;
import com.expensetracker.income.dto.IncomeDtos.IncomeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/api/incomes")
@Tag(name = "Incomes", description = "Payroll detail attached to income transactions")
public class IncomeController {

    private final IncomeService incomeService;

    public IncomeController(IncomeService incomeService) {
        this.incomeService = incomeService;
    }

    @GetMapping
    @Operation(summary = "List incomes, optionally within a date range")
    public List<IncomeResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return incomeService.list(from, to);
    }

    @PostMapping
    @Operation(summary = "Create an income record")
    public ResponseEntity<IncomeResponse> create(@Valid @RequestBody IncomeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(incomeService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an income record, typically to add the gross amount")
    public IncomeResponse update(@PathVariable UUID id, @Valid @RequestBody IncomeRequest request) {
        return incomeService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an income record")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        incomeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
