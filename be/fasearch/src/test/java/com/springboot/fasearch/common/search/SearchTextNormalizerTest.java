package com.springboot.fasearch.common.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SearchTextNormalizerTest {

    @Test
    void lowerCasesAndRemovesVietnameseAccents() {
        assertEquals("quan", SearchTextNormalizer.normalize("Quần"));
        assertEquals("quan", SearchTextNormalizer.normalize("quan"));
        assertEquals("quan", SearchTextNormalizer.normalize("QUAN"));
        assertEquals("den", SearchTextNormalizer.normalize("Đen"));
        assertEquals("den", SearchTextNormalizer.normalize("den"));
        assertEquals("den", SearchTextNormalizer.normalize("ĐEN"));
    }

    @Test
    void coversEveryVietnameseVowelWithToneAndD() {
        assertEquals("ao so mi oxford", SearchTextNormalizer.normalize("Áo sơ mi Oxford"));
        assertEquals("ao thun nam", SearchTextNormalizer.normalize("ÁO THUN NAM"));
        assertEquals("quan tay nu", SearchTextNormalizer.normalize("Quần tây nữ"));
        assertEquals("dac biet", SearchTextNormalizer.normalize("Đặc biệt"));
        assertEquals("u u u u u", SearchTextNormalizer.normalize("Ư Ứ Ử Ữ Ự"));
    }

    @Test
    void collapsesRepeatedWhitespaceAndTrims() {
        assertEquals("quan jeans", SearchTextNormalizer.normalize("  Quần   jeans  "));
        assertEquals("ao so mi", SearchTextNormalizer.normalize("Áo\tsơ\nmi"));
        assertEquals("", SearchTextNormalizer.normalize("   "));
        assertEquals("", SearchTextNormalizer.normalize(null));
    }

    @Test
    void escapesLikeWildcardsAndBackslash() {
        assertEquals("100\\%", SearchTextNormalizer.escapeLike("100%"));
        assertEquals("a\\_b", SearchTextNormalizer.escapeLike("a_b"));
        assertEquals("a\\\\b", SearchTextNormalizer.escapeLike("a\\b"));

        String percent = SearchTextNormalizer.containsPattern("%");
        assertEquals("%\\%%", percent);
        assertTrue(percent.startsWith("%") && percent.endsWith("%"));

        assertEquals("%\\_\\%%", SearchTextNormalizer.containsPattern(" _% "));
        assertNull(SearchTextNormalizer.containsPattern("   "));
        assertNull(SearchTextNormalizer.containsPattern(null));
    }

    @Test
    void clampsToTheMaximumQueryLength() {
        String longQuery = "a".repeat(SearchTextNormalizer.MAX_QUERY_LENGTH + 25);
        assertEquals(SearchTextNormalizer.MAX_QUERY_LENGTH, SearchTextNormalizer.clamp(longQuery).length());
        assertEquals("quan", SearchTextNormalizer.clamp("  Quần  "));
    }
}
