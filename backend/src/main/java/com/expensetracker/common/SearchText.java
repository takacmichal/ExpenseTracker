package com.expensetracker.common;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import java.text.Normalizer;

/**
 * Case- and accent-insensitive substring search done in the database without extensions.
 *
 * <p>The column is folded with PostgreSQL's built-in {@code translate()} over a fixed table of
 * accented Latin letters (Latin-1 Supplement and Latin Extended-A, i.e. Slovak, Czech, Hungarian,
 * German, …) and then {@code lower()}ed. Translating first means {@code lower()} only ever sees
 * ASCII letters for those characters, so the result does not depend on the database's
 * {@code LC_CTYPE}. The query side is folded with {@link TextNormalizer}, which agrees with the table
 * for every character it contains. {@code unaccent} would cover more scripts, but it is an
 * extension: it needs {@code CREATE} rights on the database and allow-listing on managed hosts.
 */
public final class SearchText {

    /** Longest accepted search query, in characters. */
    public static final int MAX_LENGTH = 100;

    private static final char ESCAPE = '\\';

    static final String ACCENTED;
    static final String PLAIN;

    static {
        StringBuilder accented = new StringBuilder();
        StringBuilder plain = new StringBuilder();
        for (char c = 'À'; c <= 'ſ'; c++) {
            String base = Normalizer.normalize(String.valueOf(c), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
            if (base.length() == 1 && base.charAt(0) < 128 && Character.isLetter(base.charAt(0))) {
                accented.append(c);
                plain.append(base.charAt(0));
            }
        }
        ACCENTED = accented.toString();
        PLAIN = plain.toString();
    }

    private SearchText() {}

    /**
     * Turns a user's query into a {@code LIKE} pattern matching it anywhere, folded and with
     * wildcards escaped with a backslash (pass it to {@link #like}). Returns {@code null} for a
     * blank query, meaning "no filter".
     *
     * @throws IllegalArgumentException if the query is longer than {@link #MAX_LENGTH}
     */
    public static String containsPattern(String query) {
        if (query == null || query.isBlank()) {
            return null;
        }
        if (query.length() > MAX_LENGTH) {
            throw new IllegalArgumentException(
                    "Hľadaný text môže mať najviac %d znakov.".formatted(MAX_LENGTH));
        }
        return "%" + escapeLike(TextNormalizer.fold(query)) + "%";
    }

    /** Escapes {@code LIKE} wildcards ({@code %}, {@code _}) and the escape character itself. */
    public static String escapeLike(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            if (c == '%' || c == '_' || c == ESCAPE) {
                escaped.append(ESCAPE);
            }
            escaped.append(c);
        }
        return escaped.toString();
    }

    /** {@code lower(translate(column, accented, plain))} — the column side of the comparison. */
    public static Expression<String> fold(CriteriaBuilder builder, Expression<String> column) {
        return builder.lower(builder.function(
                "translate", String.class, column, builder.literal(ACCENTED), builder.literal(PLAIN)));
    }

    /** {@code fold(column) LIKE pattern ESCAPE '\'}, for a pattern from {@link #containsPattern}. */
    public static Predicate like(
            CriteriaBuilder builder, Expression<String> column, String pattern) {
        return builder.like(fold(builder, column), pattern, ESCAPE);
    }
}
