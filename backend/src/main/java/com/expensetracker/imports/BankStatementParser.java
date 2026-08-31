package com.expensetracker.imports;

import java.io.InputStream;
import java.util.List;

/**
 * Turns a bank statement export into rows the import service can persist.
 * Add a new implementation per bank export format.
 */
public interface BankStatementParser {

    List<ParsedRow> parse(InputStream inputStream);
}
