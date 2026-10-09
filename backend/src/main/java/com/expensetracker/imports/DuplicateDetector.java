package com.expensetracker.imports;

import com.expensetracker.common.TextNormalizer;
import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.Transaction;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Flags parsed rows the account already holds, so re-importing an overlapping statement does not
 * double the spending.
 *
 * <p>Identity is date + amount + direction + accent-folded description. Matching is one-to-one: two
 * identical coffees on the same day are both legitimate, so if the account holds one and the file
 * has two, only one is flagged.
 */
final class DuplicateDetector {

    private DuplicateDetector() {}

    static List<ParsedRow> flag(List<ParsedRow> rows, List<Transaction> existing) {
        Map<String, Integer> remaining = new HashMap<>();
        for (Transaction transaction : existing) {
            remaining.merge(
                    key(transaction.getDate(), transaction.getAmount(), transaction.getType(), transaction.getDescription()),
                    1,
                    Integer::sum);
        }

        List<ParsedRow> flagged = new ArrayList<>(rows.size());
        for (ParsedRow row : rows) {
            if (!row.isValid()) {
                flagged.add(row);
                continue;
            }
            String key = key(row.date(), row.amount(), row.type(), row.description());
            Integer left = remaining.get(key);
            if (left != null && left > 0) {
                remaining.put(key, left - 1);
                flagged.add(row.asDuplicate());
            } else {
                flagged.add(row);
            }
        }
        return flagged;
    }

    private static String key(LocalDate date, BigDecimal amount, TransactionType type, String description) {
        return date + "|" + amount.setScale(2, RoundingMode.HALF_UP).toPlainString() + "|" + type + "|"
                + TextNormalizer.fold(description);
    }
}
