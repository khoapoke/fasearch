package com.springboot.fasearch.modules.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

/** RFC 4180 edge cases of the import parser. */
class CsvParserTest {

    @Test
    void readsBomCrlfQuotesCommasAndEmbeddedNewlines() {
        String text = "\uFEFFTên,Giá\r\n"
                + "\"Áo \"\"đẹp\"\", mùa hè\",150000\r\n"
                + "\"Nhiều\ndòng\",2\r\n";
        List<CsvParser.Row> rows = CsvParser.parse(text.getBytes(StandardCharsets.UTF_8));

        assertEquals(3, rows.size());
        assertEquals(List.of("Tên", "Giá"), rows.get(0).values());
        assertEquals(List.of("Áo \"đẹp\", mùa hè", "150000"), rows.get(1).values());
        assertEquals(List.of("Nhiều\ndòng", "2"), rows.get(2).values());
        assertEquals(1, rows.get(0).rowNumber());
        assertEquals(2, rows.get(1).rowNumber());
        assertEquals(3, rows.get(2).rowNumber());
    }

    @Test
    void acceptsLfOnlyAndKeepsRecordNumbersDespiteBlankLines() {
        String text = "A,B\n\n1,2\n3,4\n";
        List<CsvParser.Row> rows = CsvParser.parse(text.getBytes(StandardCharsets.UTF_8));

        assertEquals(3, rows.size());
        assertEquals(List.of("1", "2"), rows.get(1).values());
        assertEquals(4, rows.get(2).rowNumber());
    }

    @Test
    void trailingNewlineDoesNotCreateAnExtraRow() {
        List<CsvParser.Row> rows = CsvParser.parse("A,B\r\n1,2\r\n".getBytes(StandardCharsets.UTF_8));
        assertEquals(2, rows.size());
        assertEquals(List.of("1", "2"), rows.get(1).values());
    }

    @Test
    void keepsFormulaTextAsDataIncludingTheExportPrefix() {
        List<CsvParser.Row> rows = CsvParser.parse(
                "A\r\n'=1+1\r\n".getBytes(StandardCharsets.UTF_8));
        assertEquals("'=1+1", rows.get(1).values().get(0));
    }

    @Test
    void rejectsNonUtf8WithAnActionableMessage() {
        byte[] windows1258 = {'T', (byte) 0xE1, 'o', ',', '1'};
        AppException failure = assertThrows(AppException.class, () -> CsvParser.parse(windows1258));
        assertEquals(ErrorCode.INVALID_REQUEST, failure.getErrorCode());
        assertTrue(failure.getMessage().contains("CSV UTF-8"));
    }

    @Test
    void rejectsUnterminatedQuote() {
        AppException failure = assertThrows(AppException.class,
                () -> CsvParser.parse("A\r\n\"chưa đóng\r\n".getBytes(StandardCharsets.UTF_8)));
        assertTrue(failure.getMessage().contains("chưa đóng"));
    }

    @Test
    void rejectsTextAfterClosingQuote() {
        AppException failure = assertThrows(AppException.class,
                () -> CsvParser.parse("A\r\n\"x\"y\r\n".getBytes(StandardCharsets.UTF_8)));
        assertTrue(failure.getMessage().contains("sau dấu ngoặc kép"));
    }

    @Test
    void rejectsEmptyFile() {
        AppException failure = assertThrows(AppException.class,
                () -> CsvParser.parse("\uFEFF\r\n\r\n".getBytes(StandardCharsets.UTF_8)));
        assertTrue(failure.getMessage().contains("trống"));
    }
}
