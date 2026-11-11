package com.springboot.fasearch.common.search;

/**
 * Normalises Vietnamese text the same way the generated {@code search_text} columns do:
 * case, Vietnamese diacritics, {@code đ}, and repeated whitespace collapsed.
 *
 * <p>Kept as an explicit character table (instead of Unicode NFD) so the Java query value and
 * the SQL column always agree. The SQL side uses the same table through {@code translate}.
 */
public final class SearchTextNormalizer {

    /** Longest accepted query; longer input is cut before it reaches the database. */
    public static final int MAX_QUERY_LENGTH = 100;

    /** Escape character used by every {@code LIKE} predicate built for search. */
    public static final char LIKE_ESCAPE = '\\';

    private static final String ACCENTED =
            "áÁàÀảẢãÃạẠăĂắẮằẰẳẲẵẴặẶâÂấẤầẦẩẨẫẪậẬéÉèÈẻẺẽẼẹẸêÊếẾềỀểỂễỄệỆíÍìÌỉỈĩĨịỊó" +
            "ÓòÒỏỎõÕọỌôÔốỐồỒổỔỗỖộỘơƠớỚờỜởỞỡỠợỢúÚùÙủỦũŨụỤưƯứỨừỪửỬữỮựỰýÝỳỲỷỶỹỸỵỴđĐ";

    private static final String PLAIN =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiio" +
            "ooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd";

    private SearchTextNormalizer() {
    }

    /** Lower case, Vietnamese accents removed, whitespace collapsed and trimmed. */
    public static String normalize(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        StringBuilder out = new StringBuilder(raw.length());
        boolean pendingSpace = false;
        for (int i = 0; i < raw.length(); i++) {
            char value = raw.charAt(i);
            if (Character.isWhitespace(value)) {
                pendingSpace = out.length() > 0;
                continue;
            }
            if (pendingSpace) {
                out.append(' ');
                pendingSpace = false;
            }
            out.append(Character.toLowerCase(deaccent(value)));
        }
        return out.toString();
    }

    /** Normalises and cuts to {@link #MAX_QUERY_LENGTH}. */
    public static String clamp(String raw) {
        String normalized = normalize(raw);
        return normalized.length() <= MAX_QUERY_LENGTH
                ? normalized
                : normalized.substring(0, MAX_QUERY_LENGTH);
    }

    /** Escapes the three characters that are special inside a {@code LIKE} pattern. */
    public static String escapeLike(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char value1 = value.charAt(i);
            if (value1 == '\\' || value1 == '%' || value1 == '_') {
                out.append('\\');
            }
            out.append(value1);
        }
        return out.toString();
    }

    /**
     * Builds the bound {@code %...%} pattern for a user query, or {@code null} when the query is
     * blank. Wildcards typed by the user become literal characters.
     */
    public static String containsPattern(String raw) {
        String normalized = clamp(raw);
        if (normalized.isEmpty()) {
            return null;
        }
        return "%" + escapeLike(normalized) + "%";
    }

    private static char deaccent(char value) {
        int index = ACCENTED.indexOf(value);
        return index >= 0 ? PLAIN.charAt(index) : value;
    }
}
