package com.expensetracker.imports;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves column positions by header name rather than by index, so a reordered or extended
 * export keeps working. Names are matched with diacritics and case removed.
 */
final class CsvHeader {

    private final Map<String, Integer> byName = new HashMap<>();

    CsvHeader(String[] headerColumns) {
        for (int i = 0; i < headerColumns.length; i++) {
            byName.putIfAbsent(normalize(headerColumns[i]), i);
        }
    }

    /** First alias that is present, or -1. */
    int find(List<String> aliases) {
        for (String alias : aliases) {
            Integer index = byName.get(normalize(alias));
            if (index != null) {
                return index;
            }
        }
        return -1;
    }

    int size() {
        return byName.size();
    }

    static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String stripped = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace("\"", "")
                .replace(' ', ' ')
                .toLowerCase();
        return stripped.replaceAll("\\s+", " ").trim();
    }
}
