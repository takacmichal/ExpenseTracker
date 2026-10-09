package com.expensetracker.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class SearchTextTest {

    @Test
    void blankQueryMeansNoFilter() {
        assertThat(SearchText.containsPattern(null)).isNull();
        assertThat(SearchText.containsPattern("   ")).isNull();
    }

    @Test
    void patternIsFoldedAndWrappedInWildcards() {
        assertThat(SearchText.containsPattern("  Kaufland KOŠICE ")).isEqualTo("%kaufland kosice%");
    }

    @Test
    void likeWildcardsAndEscapeCharacterAreEscaped() {
        assertThat(SearchText.escapeLike("50% off_now\\x")).isEqualTo("50\\% off\\_now\\\\x");
        assertThat(SearchText.containsPattern("100%")).isEqualTo("%100\\%%");
    }

    @Test
    void tooLongQueryIsRejected() {
        assertThatThrownBy(() -> SearchText.containsPattern("a".repeat(SearchText.MAX_LENGTH + 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** translate() needs both strings the same length, and the SQL fold must agree with the Java one. */
    @Test
    void translateTableAgreesWithTextNormalizer() {
        assertThat(SearchText.ACCENTED).hasSameSizeAs(SearchText.PLAIN);
        for (char c : "áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽőűöü".toCharArray()) {
            assertThat(SearchText.ACCENTED).contains(String.valueOf(c));
        }
        for (int i = 0; i < SearchText.ACCENTED.length(); i++) {
            String accented = String.valueOf(SearchText.ACCENTED.charAt(i));
            String plain = String.valueOf(SearchText.PLAIN.charAt(i));
            assertThat(TextNormalizer.fold(accented)).isEqualTo(plain.toLowerCase());
        }
    }
}
