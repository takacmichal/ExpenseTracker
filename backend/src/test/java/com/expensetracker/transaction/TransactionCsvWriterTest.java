package com.expensetracker.transaction;

import static org.assertj.core.api.Assertions.assertThat;

import com.expensetracker.account.Account;
import com.expensetracker.category.Category;
import com.expensetracker.common.TransactionType;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class TransactionCsvWriterTest {

    private static Transaction transaction(String description, String amount, Category category) {
        Transaction transaction = new Transaction();
        transaction.setDate(LocalDate.of(2026, 3, 7));
        transaction.setDescription(description);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAccount(new Account(null, "Bežný účet", "EUR"));
        transaction.setCategory(category);
        return transaction;
    }

    @Test
    void startsWithBomAndUsesSemicolonsAndDecimalComma() {
        Category groceries = new Category();
        groceries.setName("Potraviny");

        String csv = new String(
                TransactionCsvWriter.write(List.of(transaction("Kaufland Košice", "1234.5", groceries))),
                StandardCharsets.UTF_8);

        assertThat(csv).startsWith("﻿Dátum;Popis;Typ;Suma;");
        assertThat(csv).contains("07.03.2026;Kaufland Košice;Výdavok;1234,50;EUR;Potraviny;Bežný účet;\r\n");
    }

    @Test
    void quotesCellsContainingTheDelimiterOrQuotes() {
        assertThat(TransactionCsvWriter.escape("a;b")).isEqualTo("\"a;b\"");
        assertThat(TransactionCsvWriter.escape("say \"hi\"")).isEqualTo("\"say \"\"hi\"\"\"");
        assertThat(TransactionCsvWriter.escape("plain")).isEqualTo("plain");
    }

    @Test
    void neutralisesSpreadsheetFormulas() {
        assertThat(TransactionCsvWriter.text("=HYPERLINK(\"x\")")).isEqualTo("'=HYPERLINK(\"x\")");
        assertThat(TransactionCsvWriter.text("Normal")).isEqualTo("Normal");
    }

    @Test
    void uncategorisedRowLeavesTheCategoryEmpty() {
        String csv = new String(
                TransactionCsvWriter.write(List.of(transaction("Lidl", "3", null))), StandardCharsets.UTF_8);

        assertThat(csv).contains(";3,00;EUR;;Bežný účet;");
    }
}
