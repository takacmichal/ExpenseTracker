package com.expensetracker.imports;

import static org.assertj.core.api.Assertions.assertThat;

import com.expensetracker.common.TransactionType;
import com.expensetracker.transaction.Transaction;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class DuplicateDetectorTest {

    private static ParsedRow row(String date, String amount, String description) {
        return ParsedRow.ok(
                1, LocalDate.parse(date), new BigDecimal(amount), description, TransactionType.EXPENSE, null, "EUR", null);
    }

    private static Transaction existing(String date, String amount, String description) {
        Transaction transaction = new Transaction();
        transaction.setDate(LocalDate.parse(date));
        transaction.setAmount(new BigDecimal(amount));
        transaction.setDescription(description);
        transaction.setType(TransactionType.EXPENSE);
        return transaction;
    }

    @Test
    void flagsARowTheAccountAlreadyHoldsIgnoringAccentsAndScale() {
        List<ParsedRow> flagged = DuplicateDetector.flag(
                List.of(row("2026-03-01", "12.5", "KAUFLAND KOSICE"), row("2026-03-02", "8.00", "Lidl")),
                List.of(existing("2026-03-01", "12.50", "Kaufland Košice")));

        assertThat(flagged).extracting(ParsedRow::duplicate).containsExactly(true, false);
    }

    @Test
    void differentDirectionIsNotADuplicate() {
        ParsedRow refund = ParsedRow.ok(
                1, LocalDate.parse("2026-03-01"), new BigDecimal("12.50"), "Kaufland", TransactionType.INCOME,
                null, "EUR", null);

        assertThat(DuplicateDetector.flag(List.of(refund), List.of(existing("2026-03-01", "12.50", "Kaufland"))))
                .extracting(ParsedRow::duplicate)
                .containsExactly(false);
    }

    /** Two identical coffees on one day are both real; one already stored covers only one of them. */
    @Test
    void matchesOneToOne() {
        List<ParsedRow> flagged = DuplicateDetector.flag(
                List.of(row("2026-03-01", "2.50", "Kaviaren"), row("2026-03-01", "2.50", "Kaviaren")),
                List.of(existing("2026-03-01", "2.50", "Kaviaren")));

        assertThat(flagged).extracting(ParsedRow::duplicate).containsExactly(true, false);
    }

    @Test
    void leavesInvalidRowsAlone() {
        List<ParsedRow> flagged = DuplicateDetector.flag(
                List.of(ParsedRow.failed(3, "bad")), List.of(existing("2026-03-01", "2.50", "Kaviaren")));

        assertThat(flagged).singleElement().satisfies(row -> {
            assertThat(row.duplicate()).isFalse();
            assertThat(row.error()).isEqualTo("bad");
        });
    }
}
