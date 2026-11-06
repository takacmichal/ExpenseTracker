package com.expensetracker.transaction;

import com.expensetracker.common.TransactionType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Writes transactions as a CSV that Excel in a Slovak locale opens correctly by double-click:
 * UTF-8 with a BOM (otherwise diacritics break), {@code ;} as the delimiter and a decimal comma.
 */
final class TransactionCsvWriter {

    private static final String BOM = "﻿";
    private static final char DELIMITER = ';';
    private static final String LINE_END = "\r\n";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final List<String> HEADER =
            List.of("Dátum", "Popis", "Typ", "Suma", "Mena", "Kategória", "Účet", "Typ transakcie v banke");

    private TransactionCsvWriter() {}

    static byte[] write(List<Transaction> transactions) {
        StringBuilder csv = new StringBuilder(BOM);
        appendLine(csv, HEADER);

        for (Transaction transaction : transactions) {
            var category = transaction.getCategory();
            appendLine(csv, List.of(
                    transaction.getDate().format(DATE),
                    text(transaction.getDescription()),
                    transaction.getType() == TransactionType.INCOME ? "Príjem" : "Výdavok",
                    amount(transaction.getAmount()),
                    text(transaction.getAccount().getCurrency()),
                    category == null ? "" : text(category.getName()),
                    text(transaction.getAccount().getName()),
                    text(transaction.getBankType())));
        }

        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    static String amount(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    /**
     * Free text comes from bank exports, so a description starting with {@code =} would otherwise be
     * evaluated as a formula when the file is opened in a spreadsheet.
     */
    static String text(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            return "'" + value;
        }
        return value;
    }

    private static void appendLine(StringBuilder csv, List<String> cells) {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                csv.append(DELIMITER);
            }
            csv.append(escape(cells.get(i)));
        }
        csv.append(LINE_END);
    }

    static String escape(String cell) {
        if (cell.indexOf(DELIMITER) < 0 && cell.indexOf('"') < 0 && cell.indexOf('\n') < 0 && cell.indexOf('\r') < 0) {
            return cell;
        }
        return '"' + cell.replace("\"", "\"\"") + '"';
    }
}
