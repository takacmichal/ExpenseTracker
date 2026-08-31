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
import com.expensetracker.transaction.Transaction;
import com.expensetracker.transaction.TransactionRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImportService {

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

    @Transactional(readOnly = true)
    public ImportPreview preview(MultipartFile file) {
        List<ParsedRow> rows = categorise(parse(file), categoryMatcher.rulesFor(currentUser.requireId()));

        int valid = (int) rows.stream().filter(ParsedRow::isValid).count();
        int categorised = (int) rows.stream().filter(row -> row.categoryId() != null).count();

        return new ImportPreview(
                file.getOriginalFilename(), rows.size(), valid, rows.size() - valid, categorised, rows);
    }

    @Transactional
    public ImportBatchResponse importCsv(MultipartFile file, UUID accountId) {
        var user = currentUser.requireReference();
        var account = accountRepository
                .findByIdAndUserId(accountId, currentUser.requireId())
                .orElseThrow(() -> new NotFoundException("Account", accountId));

        List<CategoryRule> rules = categoryMatcher.rulesFor(user.getId());
        List<ParsedRow> rows = categorise(
                parse(file).stream().filter(ParsedRow::isValid).toList(), rules);

        Map<UUID, Category> categoriesById = rules.stream()
                .map(CategoryRule::getCategory)
                .collect(Collectors.toMap(Category::getId, category -> category, (first, second) -> first));

        ImportBatch batch = new ImportBatch();
        batch.setUser(user);
        batch.setFilename(file.getOriginalFilename());
        batch.setImportedAt(Instant.now());
        batch.setRowCount(rows.size());
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
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        try {
            return parser.parse(file.getInputStream());
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
