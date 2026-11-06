package com.expensetracker.imports;

import com.expensetracker.common.TransactionType;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Parser for the George (Slovenská sporiteľňa) CSV export.
 *
 * <p>Header layout the export produces:
 * {@code Vlastný názov účtu, Vlastný IBAN, Dátum splatnosti, Suma, Mena, Partner, IBAN partnera,
 * BIC SWIFT kód banky partnera, Číslo účtu partnera, CC kód banky partnera, Popis transakcie,
 * Typ transakcie, Konštantný symbol, Špecifický symbol, Variabilný symbol}
 *
 * <p>Columns are resolved by name, and delimiter, encoding, date format and decimal separator are
 * all detected from the file, because George lets the user choose several of them at export time.
 */
@Component
public class GeorgeCsvParser implements BankStatementParser {

    private static final List<String> DATE_ALIASES =
            List.of("datum splatnosti", "datum zuctovania", "datum valuty", "datum uctovania", "datum");
    private static final List<String> AMOUNT_ALIASES = List.of("suma", "suma transakcie", "ciastka");
    private static final List<String> CURRENCY_ALIASES = List.of("mena");
    private static final List<String> PARTNER_ALIASES = List.of("partner", "nazov partnera", "protiucet");
    private static final List<String> DESCRIPTION_ALIASES =
            List.of("popis transakcie", "popis", "poznamka", "sprava pre prijemcu");
    private static final List<String> TYPE_ALIASES = List.of("typ transakcie", "typ");
    private static final List<String> VARIABLE_SYMBOL_ALIASES = List.of("variabilny symbol", "vs");

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("d.M.yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"));

    @Override
    public List<ParsedRow> parse(InputStream inputStream) {
        byte[] bytes = readAll(inputStream);
        String text = decode(bytes);
        List<String> lines = text.lines().filter(line -> !line.isBlank()).toList();

        if (lines.isEmpty()) {
            return List.of(ParsedRow.failed(0, "Súbor je prázdny"));
        }

        char delimiter = detectDelimiter(lines.get(0));
        CsvHeader header = new CsvHeader(splitColumns(lines.get(0), delimiter));

        int dateColumn = header.find(DATE_ALIASES);
        int amountColumn = header.find(AMOUNT_ALIASES);

        if (dateColumn < 0 || amountColumn < 0) {
            return List.of(ParsedRow.failed(
                    1,
                    "V hlavičke chýba stĺpec s dátumom alebo sumou. Našiel som %d stĺpcov."
                            .formatted(header.size())));
        }

        int currencyColumn = header.find(CURRENCY_ALIASES);
        int partnerColumn = header.find(PARTNER_ALIASES);
        int descriptionColumn = header.find(DESCRIPTION_ALIASES);
        int typeColumn = header.find(TYPE_ALIASES);
        int variableSymbolColumn = header.find(VARIABLE_SYMBOL_ALIASES);

        List<ParsedRow> rows = new ArrayList<>();

        for (int i = 1; i < lines.size(); i++) {
            int lineNumber = i + 1;
            String[] columns = splitColumns(lines.get(i), delimiter);

            try {
                LocalDate date = parseDate(value(columns, dateColumn));
                BigDecimal signedAmount = parseAmount(value(columns, amountColumn));

                String partner = value(columns, partnerColumn);
                // transactions.bank_type is VARCHAR(100); an over-long value would fail the whole import.
                String bankType = truncate(value(columns, typeColumn), 100);
                String description = buildDescription(
                        partner,
                        value(columns, descriptionColumn),
                        bankType,
                        value(columns, variableSymbolColumn));

                TransactionType type =
                        signedAmount.signum() < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;

                rows.add(ParsedRow.ok(
                        lineNumber,
                        date,
                        signedAmount.abs(),
                        description,
                        type,
                        partner.isBlank() ? null : partner,
                        emptyToNull(value(columns, currencyColumn)),
                        emptyToNull(bankType)));
            } catch (RuntimeException ex) {
                rows.add(ParsedRow.failed(lineNumber, ex.getMessage()));
            }
        }

        return rows;
    }

    /** The bank name carries the categorisation signal, so it leads; the rest only adds context. */
    private String buildDescription(String partner, String description, String type, String variableSymbol) {
        List<String> parts = new ArrayList<>();

        if (!partner.isBlank()) {
            parts.add(partner.trim());
        }
        if (!description.isBlank() && !description.trim().equalsIgnoreCase(partner.trim())) {
            parts.add(description.trim());
        }
        if (parts.isEmpty() && !type.isBlank()) {
            parts.add(type.trim());
        }
        if (parts.isEmpty() && !variableSymbol.isBlank()) {
            parts.add("VS " + variableSymbol.trim());
        }

        return truncate(String.join(" · ", parts), 255);
    }

    private static String truncate(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private LocalDate parseDate(String raw) {
        String value = raw.trim().replace(" ", "");
        if (value.isEmpty()) {
            throw new IllegalArgumentException("Chýba dátum");
        }

        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(value, format);
            } catch (DateTimeParseException ignored) {
                // try the next supported layout
            }
        }
        throw new IllegalArgumentException("Neznámy formát dátumu: " + raw.trim());
    }

    private BigDecimal parseAmount(String raw) {
        String value = raw.trim()
                .replace(" ", "")
                .replace(" ", "")
                .replace(" ", "")
                .replace("€", "")
                .replace("EUR", "")
                .replace("+", "");

        if (value.isEmpty()) {
            throw new IllegalArgumentException("Chýba suma");
        }

        // Whichever separator comes last is the decimal one; the other groups thousands.
        boolean commaIsDecimal = value.lastIndexOf(',') > value.lastIndexOf('.');
        String normalized =
                commaIsDecimal ? value.replace(".", "").replace(',', '.') : value.replace(",", "");

        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Neplatná suma: " + raw.trim());
        }
    }

    /** George offers both comma and semicolon at export time. */
    private char detectDelimiter(String headerLine) {
        long semicolons = headerLine.chars().filter(c -> c == ';').count();
        long commas = headerLine.chars().filter(c -> c == ',').count();
        long tabs = headerLine.chars().filter(c -> c == '\t').count();

        if (tabs > semicolons && tabs > commas) {
            return '\t';
        }
        return semicolons > commas ? ';' : ',';
    }

    /**
     * George exports UTF-16 LE with a BOM by default, but the encoding is selectable, so every
     * plausible variant is detected here.
     *
     * <p>Guessing wrong is not a harmless fallback: read as a single-byte charset, the second byte
     * of {@code č} (U+010D, stored as {@code 0d 01}) is a carriage return, which silently cuts the
     * header in half.
     */
    private String decode(byte[] bytes) {
        if (startsWith(bytes, 0xEF, 0xBB, 0xBF)) {
            return new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
        }
        if (startsWith(bytes, 0xFF, 0xFE)) {
            return new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16LE);
        }
        if (startsWith(bytes, 0xFE, 0xFF)) {
            return new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16BE);
        }

        Charset bomless = detectBomlessUtf16(bytes);
        if (bomless != null) {
            return new String(bytes, bomless);
        }

        try {
            return StandardCharsets.UTF_8
                    .newDecoder()
                    .decode(java.nio.ByteBuffer.wrap(bytes))
                    .toString();
        } catch (java.nio.charset.CharacterCodingException ex) {
            return new String(bytes, Charset.forName("windows-1250"));
        }
    }

    /** ASCII-heavy UTF-16 without a BOM shows a NUL in every second byte; the side tells the order. */
    private Charset detectBomlessUtf16(byte[] bytes) {
        int sample = Math.min(bytes.length, 512);
        if (sample < 4) {
            return null;
        }

        int nullsAtOdd = 0;
        int nullsAtEven = 0;
        for (int i = 0; i < sample; i++) {
            if (bytes[i] == 0) {
                if (i % 2 == 0) {
                    nullsAtEven++;
                } else {
                    nullsAtOdd++;
                }
            }
        }

        int threshold = sample / 4;
        if (nullsAtOdd > threshold && nullsAtEven == 0) {
            return StandardCharsets.UTF_16LE;
        }
        if (nullsAtEven > threshold && nullsAtOdd == 0) {
            return StandardCharsets.UTF_16BE;
        }
        return null;
    }

    private boolean startsWith(byte[] bytes, int... prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if ((bytes[i] & 0xFF) != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private byte[] readAll(InputStream inputStream) {
        try (InputStream in = inputStream) {
            return in.readAllBytes();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    private String value(String[] columns, int index) {
        return index >= 0 && index < columns.length ? columns[index] : "";
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Splits on the delimiter while honouring double-quoted fields and doubled escapes. */
    private String[] splitColumns(String line, char delimiter) {
        List<String> columns = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);

            if (c == '"') {
                boolean escapedQuote = inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"';
                if (escapedQuote) {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == delimiter && !inQuotes) {
                columns.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        columns.add(current.toString());

        return columns.toArray(String[]::new);
    }

    /** Convenience entry point for tests. */
    List<ParsedRow> parse(String csv) {
        return parse(new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
    }
}
