package com.expensetracker.imports;

import com.expensetracker.imports.dto.ImportDtos.ImportBatchResponse;
import com.expensetracker.imports.dto.ImportDtos.ImportPreview;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
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
    @Operation(summary = "Parse a CSV without persisting anything, for on-screen review")
    public ImportPreview preview(@RequestPart("file") MultipartFile file) {
        return importService.preview(file);
    }

    @PostMapping(value = "/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Parse a CSV and persist its valid rows as transactions")
    public ImportBatchResponse importCsv(
            @RequestPart("file") MultipartFile file, @RequestParam UUID accountId) {
        return importService.importCsv(file, accountId);
    }

    @GetMapping("/batches")
    @Operation(summary = "List past imports")
    public List<ImportBatchResponse> batches() {
        return importService.listBatches();
    }
}
