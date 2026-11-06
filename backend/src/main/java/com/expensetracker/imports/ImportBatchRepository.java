package com.expensetracker.imports;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, UUID> {

    List<ImportBatch> findByUserIdOrderByImportedAtDesc(UUID userId);

    Optional<ImportBatch> findByIdAndUserId(UUID id, UUID userId);
}
