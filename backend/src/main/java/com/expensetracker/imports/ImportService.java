package com.expensetracker.imports;

import com.expensetracker.account.AccountRepository;
import com.expensetracker.auth.CurrentUser;
import com.expensetracker.category.Category;
import com.expensetracker.category.CategoryMatcher;
import com.expensetracker.category.CategoryRule;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.common.TransactionSource;
import com.expensetracker.imports.dto.ImportDtos.ImportBatchResponse;
import com.expensetracker.imports.dto.ImportDtos.ImportPreview;
import com.expensetracker.imports.dto.ImportDtos.UndoImportResult;
import com.expensetracker.transaction.Transaction;
import com.expensetracker.transaction.TransactionRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImportService {

    private static final String DEFAULT_FILENAME = "import.csv";
    private static final int MAX_FILENAME_LENGTH = 255;

    private final BankStatementParser parser;
    private final ImportBatchRepository importBatchRepository;
    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final CategoryMatcher categoryMatcher;
    private final CurrentUser currentUser;

    public ImportService(
            BankStatementParser parser,
            ImportBatchRepository importBatchRepository,
            TransactionRepository transactionRepository,
            AccountRepository accountRepository,
            CategoryMatcher categoryMatcher,
            CurrentUser currentUser) {
        this.parser = parser;
        this.importBatchRepository = importBatchRepository;
        this.transactionRepository = transactionRepository;
        this.accountRepository = accountRepository;
        this.categoryMatcher = categoryMatcher;
        this.currentUser = currentUser;
    }

    /**
     * With an {@code accountId} the rows that account already holds are flagged as duplicates;
     * without one there is nothing to compare against, so none are.
     */
    @Transactional(readOnly = true)
    public ImportPreview preview(MultipartFile file, UUID accountId) {
        UUID userId = currentUser.requireId();
        List<ParsedRow> rows = categorise(parse(file), categoryMatcher.rulesFor(userId));

        if (accountId != null) {
            accountRepository
                    .findByIdAndUserId(accountId, userId)
                    .orElseThrow(() -> new NotFoundException("Účet", accountId));
            rows = flagDuplicates(rows, userId, accountId);
        }

        int valid = (int) rows.stream().filter(ParsedRow::isValid).count();
        int categorised = (int) rows.stream().filter(row -> row.categoryId() != null).count();
        int duplicates = (int) rows.stream().filter(ParsedRow::duplicate).count();

        return new ImportPreview(
                filenameOf(file), rows.size(), valid, rows.size() - valid, categorised, duplicates, rows);
    }

    @Transactional
    public ImportBatchResponse importCsv(MultipartFile file, UUID accountId) {
        var user = currentUser.requireReference();
        var account = accountRepository
                .findByIdAndUserId(accountId, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Účet", accountId));

        List<CategoryRule> rules = categoryMatcher.rulesFor(user.getId());
        List<ParsedRow> candidates = flagDuplicates(
                categorise(parse(file).stream().filter(ParsedRow::isValid).toList(), rules),
                user.getId(),
                accountId);
        List<ParsedRow> rows = candidates.stream().filter(row -> !row.duplicate()).toList();

        Map<UUID, Category> categoriesById = rules.stream()
                .map(CategoryRule::getCategory)
                .collect(Collectors.toMap(Category::getId, category -> category, (first, second) -> first));

        ImportBatch batch = new ImportBatch();
        batch.setUser(user);
        batch.setFilename(filenameOf(file));
        batch.setImportedAt(Instant.now());
        batch.setRowCount(rows.size());
        batch.setDuplicateCount(candidates.size() - rows.size());
        batch.setStatus(ImportStatus.COMPLETED);
        importBatchRepository.save(batch);

        for (ParsedRow row : rows) {
            Transaction transaction = new Transaction();
            transaction.setUser(user);
            transaction.setAccount(account);
            transaction.setAmount(row.amount());
            transaction.setDate(row.date());
            transaction.setDescription(row.description());
            transaction.setBankType(row.bankType());
            transaction.setType(row.type());
            transaction.setSource(TransactionSource.IMPORT);
            transaction.setImportBatch(batch);
            transaction.setCategory(row.categoryId() == null ? null : categoriesById.get(row.categoryId()));
            transactionRepository.save(transaction);
        }

        return ImportBatchResponse.from(batch);
    }

    @Transactional(readOnly = true)
    public List<ImportBatchResponse> listBatches() {
        return importBatchRepository.findByUserIdOrderByImportedAtDesc(currentUser.requireId()).stream()
                .map(ImportBatchResponse::from)
                .toList();
    }

    /**
     * Undoes an import: removes every transaction the batch created, including ones edited since,
     * and then the batch itself.
     */
    @Transactional
    public UndoImportResult deleteBatch(UUID id) {
        UUID userId = currentUser.requireId();
        ImportBatch batch = importBatchRepository
                .findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Import", id));

        int deleted = transactionRepository.deleteByImportBatch(batch.getId(), userId);
        importBatchRepository.delete(batch);
        return new UndoImportResult(batch.getId(), deleted);
    }

    /** Compares only against the date range the file covers, so a large account is not loaded whole. */
    private List<ParsedRow> flagDuplicates(List<ParsedRow> rows, UUID userId, UUID accountId) {
        List<LocalDate> dates = rows.stream().filter(ParsedRow::isValid).map(ParsedRow::date).toList();
        if (dates.isEmpty()) {
            return rows;
        }
        LocalDate from = dates.stream().min(Comparator.naturalOrder()).orElseThrow();
        LocalDate to = dates.stream().max(Comparator.naturalOrder()).orElseThrow();

        return DuplicateDetector.flag(
                rows, transactionRepository.findByUserIdAndAccountIdAndDateBetween(userId, accountId, from, to));
    }

    /** Applies the rules once, so the preview and the import cannot disagree. */
    private List<ParsedRow> categorise(List<ParsedRow> rows, List<CategoryRule> rules) {
        return rows.stream()
                .map(row -> {
                    if (!row.isValid()) {
                        return row;
                    }
                    return categoryMatcher
                            .match(row.description(), row.bankType(), row.type(), rules)
                            .map(category -> row.withCategory(category.getId(), category.getName(), category.getColor()))
                            .orElse(row);
                })
                .toList();
    }

    private List<ParsedRow> parse(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Nahraný súbor je prázdny.");
        }
        try {
            return parser.parse(file.getInputStream());
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /** import_batches.filename is NOT NULL VARCHAR(255), and the client controls the name it sends. */
    static String filenameOf(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || name.isBlank()) {
            return DEFAULT_FILENAME;
        }
        return name.length() > MAX_FILENAME_LENGTH ? name.substring(0, MAX_FILENAME_LENGTH) : name;
    }
}
