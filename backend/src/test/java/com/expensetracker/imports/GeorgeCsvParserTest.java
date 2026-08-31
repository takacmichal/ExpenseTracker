package com.expensetracker.imports;

import static org.assertj.core.api.Assertions.assertThat;

import com.expensetracker.common.TransactionType;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class GeorgeCsvParserTest {

    /** Verbatim header from a real George export. */
    private static final String HEADER =
            "Vlastný názov účtu,\"Vlastný IBAN\",\"Dátum splatnosti\",\"Suma\",\"Mena\",\"Partner\","
                    + "\"IBAN partnera\",\"BIC SWIFT kód banky partnera\",\"Číslo účtu partnera\","
                    + "\"CC kód banky partnera\",\"Popis transakcie\",\"Typ transakcie\","
                    + "\"Konštantný symbol\",\"Špecifický symbol\",\"Variabilný symbol\"";

    private final GeorgeCsvParser parser = new GeorgeCsvParser();

    /**
     * Verbatim line from a real export: unquoted first field, empty "Popis transakcie",
     * and the description therefore falling back to the partner alone.
     */
    @Test
    void parsesRealExportLine() {
        List<ParsedRow> rows = parser.parse(HEADER + "\n"
                + "SPACE účet,\"SK7809000000005141511632\",\"23.08.2026\",\"-25,01\",\"EUR\","
                + "\"SHELL 8258\",\"\",\"\",\"\",\"\",\"\",\"Platba kartou\",\"\",\"\",\"\"");

        assertThat(rows).hasSize(1);
        ParsedRow row = rows.getFirst();

        assertThat(row.isValid()).isTrue();
        assertThat(row.date()).isEqualTo(LocalDate.of(2026, 8, 23));
        assertThat(row.amount()).isEqualByComparingTo(new BigDecimal("25.01"));
        assertThat(row.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(row.description()).isEqualTo("SHELL 8258");
        assertThat(row.counterparty()).isEqualTo("SHELL 8258");
        assertThat(row.currency()).isEqualTo("EUR");
    }

    @Test
    void mapsColumnsByHeaderName() {
        List<ParsedRow> rows = parser.parse(HEADER + "\n"
                + "\"Bežný účet\",\"SK7809000000005141511632\",\"05.01.2026\",\"-8,30\",\"EUR\","
                + "\"McDonalds KE4\",\"\",\"\",\"\",\"\",\"Platba kartou\",\"Platba kartou\",\"\",\"\",\"\"");

        assertThat(rows).hasSize(1);
        ParsedRow row = rows.getFirst();

        assertThat(row.isValid()).isTrue();
        assertThat(row.date()).isEqualTo(LocalDate.of(2026, 1, 5));
        assertThat(row.amount()).isEqualByComparingTo(new BigDecimal("8.30"));
        assertThat(row.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(row.counterparty()).isEqualTo("McDonalds KE4");
        assertThat(row.currency()).isEqualTo("EUR");
        assertThat(row.description()).contains("McDonalds KE4");
    }

    @Test
    void treatsPositiveAmountAsIncome() {
        List<ParsedRow> rows = parser.parse(HEADER + "\n"
                + "\"Bežný účet\",\"SK78\",\"05.01.2026\",\"200,00\",\"EUR\",\"Michal Tkáč\","
                + "\"\",\"\",\"\",\"\",\"SEPA platba Prijatá\",\"SEPA platba\",\"\",\"\",\"\"");

        assertThat(rows.getFirst().type()).isEqualTo(TransactionType.INCOME);
        assertThat(rows.getFirst().amount()).isEqualByComparingTo(new BigDecimal("200.00"));
    }

    @Test
    void survivesReorderedAndExtraColumns() {
        List<ParsedRow> rows = parser.parse(
                "\"Suma\",\"Dátum splatnosti\",\"Nový stĺpec\",\"Partner\"\n" + "\"-12,50\",\"7.2.2026\",\"x\",\"Lidl\"");

        ParsedRow row = rows.getFirst();
        assertThat(row.isValid()).isTrue();
        assertThat(row.date()).isEqualTo(LocalDate.of(2026, 2, 7));
        assertThat(row.amount()).isEqualByComparingTo(new BigDecimal("12.50"));
        assertThat(row.counterparty()).isEqualTo("Lidl");
    }

    @Test
    void handlesSemicolonDelimiterAndThousandsSeparator() {
        List<ParsedRow> rows =
                parser.parse("\"Dátum splatnosti\";\"Suma\";\"Partner\"\n" + "\"05.01.2026\";\"-1 234,56\";\"Nájom\"");

        assertThat(rows.getFirst().amount()).isEqualByComparingTo(new BigDecimal("1234.56"));
    }

    @Test
    void handlesIsoDateAndDotDecimal() {
        List<ParsedRow> rows = parser.parse("\"Dátum splatnosti\",\"Suma\"\n" + "\"2026-01-05\",\"-8.30\"");

        assertThat(rows.getFirst().date()).isEqualTo(LocalDate.of(2026, 1, 5));
        assertThat(rows.getFirst().amount()).isEqualByComparingTo(new BigDecimal("8.30"));
    }

    @Test
    void keepsQuotedDelimiterInsideField() {
        List<ParsedRow> rows = parser.parse(
                "\"Dátum splatnosti\",\"Suma\",\"Partner\"\n" + "\"05.01.2026\",\"-8,30\",\"Kaufland SK 1930, KE\"");

        assertThat(rows.getFirst().counterparty()).isEqualTo("Kaufland SK 1930, KE");
    }

    @Test
    void reportsUnparseableRowInsteadOfFailingWholeFile() {
        List<ParsedRow> rows = parser.parse(HEADER + "\n"
                + "\"Bežný účet\",\"SK78\",\"nezmysel\",\"-8,30\",\"EUR\",\"X\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n"
                + "\"Bežný účet\",\"SK78\",\"06.01.2026\",\"-1,49\",\"EUR\",\"Lidl\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"");

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).isValid()).isFalse();
        assertThat(rows.get(0).error()).contains("dátum");
        assertThat(rows.get(1).isValid()).isTrue();
    }

    /** George's default export encoding. */
    @Test
    void readsUtf16LittleEndianWithBom() {
        String csv = HEADER + "\r\n"
                + "\"SPACE účet\",\"SK78\",\"23.08.2026\",\"-25,01\",\"EUR\",\"SHELL 8258\","
                + "\"\",\"\",\"\",\"\",\"\",\"Platba kartou\",\"\",\"\",\"\"";

        byte[] utf16 = csv.getBytes(StandardCharsets.UTF_16LE);
        byte[] withBom = new byte[utf16.length + 2];
        withBom[0] = (byte) 0xFF;
        withBom[1] = (byte) 0xFE;
        System.arraycopy(utf16, 0, withBom, 2, utf16.length);

        List<ParsedRow> rows = parser.parse(new ByteArrayInputStream(withBom));

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().isValid()).isTrue();
        assertThat(rows.getFirst().amount()).isEqualByComparingTo(new BigDecimal("25.01"));
        assertThat(rows.getFirst().counterparty()).isEqualTo("SHELL 8258");
    }

    @Test
    void readsUtf16BigEndianWithBom() {
        byte[] utf16 = ("\"Dátum splatnosti\",\"Suma\"\r\n\"23.08.2026\",\"-25,01\"")
                .getBytes(StandardCharsets.UTF_16BE);
        byte[] withBom = new byte[utf16.length + 2];
        withBom[0] = (byte) 0xFE;
        withBom[1] = (byte) 0xFF;
        System.arraycopy(utf16, 0, withBom, 2, utf16.length);

        assertThat(parser.parse(new ByteArrayInputStream(withBom)).getFirst().isValid())
                .isTrue();
    }

    @Test
    void readsUtf8WithBom() {
        byte[] body = ("\"Dátum splatnosti\",\"Suma\"\n\"23.08.2026\",\"-25,01\"")
                .getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[body.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(body, 0, withBom, 3, body.length);

        assertThat(parser.parse(new ByteArrayInputStream(withBom)).getFirst().isValid())
                .isTrue();
    }

    @Test
    void readsWindows1250WhenNotValidUtf8() {
        byte[] body = ("\"Dátum splatnosti\",\"Suma\",\"Partner\"\n\"23.08.2026\",\"-25,01\",\"Kaufland Košice\"")
                .getBytes(Charset.forName("windows-1250"));

        ParsedRow row = parser.parse(new ByteArrayInputStream(body)).getFirst();

        assertThat(row.isValid()).isTrue();
        assertThat(row.counterparty()).isEqualTo("Kaufland Košice");
    }

    @Test
    void reportsMissingRequiredColumns() {
        List<ParsedRow> rows = parser.parse("\"Partner\",\"Mena\"\n" + "\"Lidl\",\"EUR\"");

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().isValid()).isFalse();
        assertThat(rows.getFirst().error()).contains("chýba stĺpec");
    }
}
