package com.springboot.fasearch.modules.csv;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * RFC 4180 writer for the admin exports.
 *
 * UTF-8 with a BOM so Excel shows Vietnamese, CRLF line endings, comma separator.
 * Text cells that start with a formula trigger are prefixed with an apostrophe; numbers are
 * written as numbers, so a negative amount stays a number instead of becoming text.
 */
public final class CsvWriter {

    public static final int BATCH_SIZE = 500;

    private static final char SEPARATOR = ',';
    private static final String LINE_END = "\r\n";
    private static final String BOM = "\uFEFF";
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final Writer out;

    public CsvWriter(OutputStream stream) throws IOException {
        this.out = new BufferedWriter(new OutputStreamWriter(stream, StandardCharsets.UTF_8), 16 * 1024);
        out.write(BOM);
    }

    public void row(Object... cells) throws IOException {
        for (int index = 0; index < cells.length; index++) {
            if (index > 0) {
                out.write(SEPARATOR);
            }
            out.write(cell(cells[index]));
        }
        out.write(LINE_END);
    }

    public void flush() throws IOException {
        out.flush();
    }

    static String cell(Object value) {
        if (value == null) {
            return "";
        }
        String raw;
        if (value instanceof BigDecimal decimal) {
            raw = decimal.stripTrailingZeros().toPlainString();
        } else if (value instanceof Number || value instanceof Boolean) {
            raw = String.valueOf(value);
        } else if (value instanceof LocalDateTime dateTime) {
            raw = DATE_TIME.format(dateTime);
        } else if (value instanceof LocalDate date) {
            raw = DATE.format(date);
        } else {
            raw = String.valueOf(value);
        }
        if (value instanceof CharSequence && startsFormula(raw)) {
            raw = "'" + raw;
        }
        if (needsQuoting(raw)) {
            return "\"" + raw.replace("\"", "\"\"") + "\"";
        }
        return raw;
    }

    private static boolean startsFormula(String value) {
        if (value.isEmpty()) {
            return false;
        }
        char first = value.charAt(0);
        return first == '=' || first == '+' || first == '-' || first == '@'
                || first == '\t' || first == '\r' || first == '\n';
    }

    private static boolean needsQuoting(String value) {
        return value.indexOf('"') >= 0 || value.indexOf(SEPARATOR) >= 0
                || value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0;
    }
}
