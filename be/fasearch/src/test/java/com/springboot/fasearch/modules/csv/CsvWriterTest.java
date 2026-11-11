package com.springboot.fasearch.modules.csv;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

/** RFC 4180, BOM, CRLF, Vietnamese, formula injection and typed numbers, proven on bytes. */
class CsvWriterTest {

    private static List<List<String>> parse(byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (text.startsWith("\uFEFF")) {
            text = text.substring(1);
        }
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < text.length(); index++) {
            char c = text.charAt(index);
            if (quoted) {
                if (c == '"') {
                    if (index + 1 < text.length() && text.charAt(index + 1) == '"') {
                        cell.append('"');
                        index++;
                    } else {
                        quoted = false;
                    }
                } else {
                    cell.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (c == '\r' && index + 1 < text.length() && text.charAt(index + 1) == '\n') {
                row.add(cell.toString());
                rows.add(row);
                row = new ArrayList<>();
                cell.setLength(0);
                index++;
            } else {
                cell.append(c);
            }
        }
        if (cell.length() > 0 || !row.isEmpty()) {
            row.add(cell.toString());
            rows.add(row);
        }
        return rows;
    }

    @Test
    void writesBomCrlfAndVietnameseThatParsesBack() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CsvWriter writer = new CsvWriter(out);
        writer.row("Tên sản phẩm", "Danh mục", "Ghi chú");
        writer.row("Áo sơ mi Oxford", "Áo sơ mi nam", "Hàng mới về");
        writer.flush();

        byte[] bytes = out.toByteArray();
        assertArrayEquals(new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF},
                new byte[] {bytes[0], bytes[1], bytes[2]});
        String text = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(text.startsWith("\uFEFF"));
        assertTrue(text.contains("\r\n"));
        assertEquals(2, text.split("\r\n").length);

        List<List<String>> rows = parse(bytes);
        assertEquals(List.of("Tên sản phẩm", "Danh mục", "Ghi chú"), rows.get(0));
        assertEquals(List.of("Áo sơ mi Oxford", "Áo sơ mi nam", "Hàng mới về"), rows.get(1));
    }

    @Test
    void quotesCommasQuotesAndNewlines() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CsvWriter writer = new CsvWriter(out);
        writer.row("Một, hai", "Nói \"xin chào\"", "Dòng một\nDòng hai", "Có\rmột mình");
        writer.flush();

        String text = new String(out.toByteArray(), StandardCharsets.UTF_8);
        assertTrue(text.contains("\"Một, hai\""));
        assertTrue(text.contains("\"Nói \"\"xin chào\"\"\""));
        assertTrue(text.contains("\"Dòng một\nDòng hai\""));
        List<List<String>> rows = parse(out.toByteArray());
        assertEquals(List.of("Một, hai", "Nói \"xin chào\"", "Dòng một\nDòng hai", "Có\rmột mình"), rows.get(0));
    }

    @Test
    void neutralisesFormulasOnlyInTextCells() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CsvWriter writer = new CsvWriter(out);
        writer.row("=SUM(A1:A2)", "+84", "-5", "@user", "\ttab", "\rcr", "\nlf", "bình thường");
        writer.row(-5, new BigDecimal("-5.00"), 150000, 0, null);
        writer.flush();

        List<List<String>> rows = parse(out.toByteArray());
        assertEquals(List.of("'=SUM(A1:A2)", "'+84", "'-5", "'@user", "'\ttab", "'\rcr", "'\nlf", "bình thường"),
                rows.get(0));
        // Genuine numbers stay numbers: a negative amount is not turned into text.
        assertEquals(List.of("-5", "-5", "150000", "0", ""), rows.get(1));
        assertFalse(new String(out.toByteArray(), StandardCharsets.UTF_8).contains("'-5\r\n"));
    }

    @Test
    void formatsVietnameseDatesAndPlainMoney() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CsvWriter writer = new CsvWriter(out);
        writer.row(LocalDateTime.of(2026, 11, 7, 14, 5), LocalDate.of(1995, 3, 9),
                new BigDecimal("1234567.50"), new BigDecimal("150000.00"), new BigDecimal("0.00"));
        writer.flush();

        List<List<String>> rows = parse(out.toByteArray());
        assertEquals(List.of("07/11/2026 14:05", "09/03/1995", "1234567.5", "150000", "0"), rows.get(0));
    }
}
