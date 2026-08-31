package com.expensetracker.imports.dto;

import com.expensetracker.imports.ImportBatch;
import com.expensetracker.imports.ImportStatus;
import com.expensetracker.imports.ParsedRow;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ImportDtos {

    private ImportDtos() {}

    public record ImportPreview(
            String filename,
            int totalRows,
            int validRows,
            int invalidRows,
            int categorisedRows,
            List<ParsedRow> rows) {}

    public record ImportBatchResponse(
            UUID id, String filename, Instant importedAt, int rowCount, ImportStatus status, String errorMessage) {

        public static ImportBatchResponse from(ImportBatch batch) {
            return new ImportBatchResponse(
                    batch.getId(),
                    batch.getFilename(),
                    batch.getImportedAt(),
                    batch.getRowCount(),
                    batch.getStatus(),
                    batch.getErrorMessage());
        }
    }
}
