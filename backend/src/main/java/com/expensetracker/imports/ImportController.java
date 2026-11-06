package com.expensetracker.imports;

import com.expensetracker.imports.dto.ImportDtos.ImportBatchResponse;
import com.expensetracker.imports.dto.ImportDtos.ImportPreview;
import com.expensetracker.imports.dto.ImportDtos.UndoImportResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/import")
@Tag(name = "Import", description = "CSV bank statement import")
public class ImportController {

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    @PostMapping(value = "/csv/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Parse a CSV without persisting anything; pass accountId to flag rows that account already holds")
    public ImportPreview preview(
            @RequestPart("file") MultipartFile file, @RequestParam(required = false) UUID accountId) {
        return importService.preview(file, accountId);
    }

    @PostMapping(value = "/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Parse a CSV and persist its valid rows as transactions, skipping duplicates")
    public ImportBatchResponse importCsv(
            @RequestPart("file") MultipartFile file, @RequestParam UUID accountId) {
        return importService.importCsv(file, accountId);
    }

    @GetMapping("/batches")
    @Operation(summary = "List past imports")
    public List<ImportBatchResponse> batches() {
        return importService.listBatches();
    }

    @DeleteMapping("/batches/{id}")
    @Operation(summary = "Undo an import: delete the batch and every transaction it created")
    public UndoImportResult deleteBatch(@PathVariable UUID id) {
        return importService.deleteBatch(id);
    }
}
