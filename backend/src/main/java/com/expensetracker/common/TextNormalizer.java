package com.expensetracker.common;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Folds text to a comparable form: no diacritics, lower case, single spaces.
 *
 * <p>Bank descriptions are inconsistent about accents for the same merchant
 * ({@code Kaufland Košice} and {@code KAUFLAND KOSICE} both occur), so matching has to ignore them.
 */
public final class TextNormalizer {

    private TextNormalizer() {}

    public static String fold(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }
}
