package com.expensetracker.transaction;

import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.dto.TransactionDtos.BulkRequest;
import com.expensetracker.transaction.dto.TransactionDtos.BulkResult;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionRequest;
import com.expensetracker.transaction.dto.TransactionDtos.TransactionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
@RequestMapping("/api/transactions")
@Tag(name = "Transactions", description = "Expense and income transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final Clock clock;

    public TransactionController(TransactionService transactionService, Clock clock) {
        this.transactionService = transactionService;
        this.clock = clock;
    }

    @GetMapping
    @Operation(summary = "Search transactions with optional date, category, account, type and text (q) filters")
    public Page<TransactionResponse> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID categoryId,
            @Parameter(description = "With categoryId: also match every subcategory of that category")
                    @RequestParam(defaultValue = "false")
                    boolean includeSubcategories,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) TransactionType type,
            @Parameter(description = "Text in the description or bank type; case- and accent-insensitive")
                    @RequestParam(required = false)
                    String q,
            @PageableDefault(size = 25, sort = "date", direction = Sort.Direction.DESC) Pageable pageable) {
        return transactionService.search(from, to, categoryId, includeSubcategories, accountId, type, q, pageable);
    }

    @GetMapping(value = "/export", produces = "text/csv")
    @Operation(summary = "Download every transaction matching the list filters as a CSV (UTF-8 with BOM, ';')")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID categoryId,
            @Parameter(description = "With categoryId: also match every subcategory of that category")
                    @RequestParam(defaultValue = "false")
                    boolean includeSubcategories,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) TransactionType type,
            @RequestParam(required = false) String q) {
        byte[] csv = transactionService.exportCsv(from, to, categoryId, includeSubcategories, accountId, type, q);
        String filename = "transakcie-%s.csv".formatted(LocalDate.now(clock));

        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(csv);
    }

    @PostMapping("/bulk")
    @Operation(summary = "Set the category of, or delete, several transactions at once")
    public BulkResult bulk(@Valid @RequestBody BulkRequest request) {
        return transactionService.bulk(request);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single transaction")
    public TransactionResponse get(@PathVariable UUID id) {
        return transactionService.get(id);
    }

    @PostMapping
    @Operation(summary = "Create a transaction")
    public ResponseEntity<TransactionResponse> create(@Valid @RequestBody TransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(transactionService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a transaction")
    public TransactionResponse update(@PathVariable UUID id, @Valid @RequestBody TransactionRequest request) {
        return transactionService.update(id, request);
    }

    @PostMapping("/categorise")
    @Operation(summary = "Apply the current rules to every transaction that still has no category")
    public Map<String, Integer> categorise() {
        return Map.of("updated", transactionService.categoriseUncategorised());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a transaction")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        transactionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
