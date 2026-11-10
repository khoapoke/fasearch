package com.springboot.fasearch.modules.csv;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

/**
 * RFC 4180 reader for the admin CSV import.
 *
 * UTF-8 is decoded strictly so a Windows-1258 export is refused with a message that names
 * "CSV UTF-8" instead of silently replacing Vietnamese characters. A leading BOM is tolerated,
 * records may end with CRLF or LF, and quoted cells may contain commas, doubled quotes and
 * newlines. Row numbers are record numbers (header = 1), so they match what Excel shows even
 * when a quoted cell spans several physical lines.
 */
public final class CsvParser {

    public record Row(int rowNumber, List<String> values) {
    }

    private static final char BOM = '\uFEFF';

    private CsvParser() {
    }

    public static List<Row> parse(byte[] bytes) {
        String text = decode(bytes);
        if (!text.isEmpty() && text.charAt(0) == BOM) {
            text = text.substring(1);
        }
        if (text.indexOf('\u0000') >= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tệp có ký tự nhị phân không hợp lệ. Hãy lưu lại dưới dạng CSV UTF-8 rồi tải lại.");
        }

        List<Row> rows = new ArrayList<>();
        List<String> values = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        boolean afterQuote = false;
        boolean atCellStart = true;
        int rowNumber = 1;
        int index = 0;

        while (index < text.length()) {
            char current = text.charAt(index);
            if (quoted) {
                if (current == '"') {
                    if (index + 1 < text.length() && text.charAt(index + 1) == '"') {
                        cell.append('"');
                        index += 2;
                        continue;
                    }
                    quoted = false;
                    afterQuote = true;
                    index++;
                    continue;
                }
                cell.append(current);
                index++;
                continue;
            }
            if (afterQuote) {
                if (current == ',') {
                    values.add(cell.toString());
                    cell.setLength(0);
                    afterQuote = false;
                    atCellStart = true;
                    index++;
                    continue;
                }
                if (current == '\r' || current == '\n') {
                    values.add(cell.toString());
                    rows.add(new Row(rowNumber, List.copyOf(values)));
                    values.clear();
                    cell.setLength(0);
                    rowNumber++;
                    atCellStart = true;
                    afterQuote = false;
                    index += (current == '\r' && index + 1 < text.length()
                            && text.charAt(index + 1) == '\n') ? 2 : 1;
                    continue;
                }
                if (current == ' ' || current == '\t') {
                    index++;
                    continue;
                }
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Dòng " + rowNumber + ": có ký tự thừa sau dấu ngoặc kép đóng.");
            }
            if (current == '"') {
                if (!atCellStart) {
                    throw new AppException(ErrorCode.INVALID_REQUEST,
                            "Dòng " + rowNumber + ": dấu ngoặc kép phải đứng ở đầu ô.");
                }
                quoted = true;
                atCellStart = false;
                index++;
                continue;
            }
            if (current == ',') {
                values.add(cell.toString());
                cell.setLength(0);
                atCellStart = true;
                index++;
                continue;
            }
            if (current == '\r' || current == '\n') {
                values.add(cell.toString());
                rows.add(new Row(rowNumber, List.copyOf(values)));
                values.clear();
                cell.setLength(0);
                rowNumber++;
                atCellStart = true;
                index += (current == '\r' && index + 1 < text.length()
                        && text.charAt(index + 1) == '\n') ? 2 : 1;
                continue;
            }
            cell.append(current);
            atCellStart = false;
            index++;
        }

        if (quoted) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Dòng " + rowNumber + ": dấu ngoặc kép chưa đóng.");
        }
        if (afterQuote || !values.isEmpty() || cell.length() > 0) {
            values.add(cell.toString());
            rows.add(new Row(rowNumber, List.copyOf(values)));
        }

        rows.removeIf(row -> row.values().stream().allMatch(String::isEmpty));
        if (rows.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tệp CSV trống. Tải tệp mẫu, điền dữ liệu rồi tải lên lại.");
        }
        return rows;
    }

    private static String decode(byte[] bytes) {
        CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        try {
            return decoder.decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException exception) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tệp không phải UTF-8. Trong Excel, chọn \"CSV UTF-8 (Comma delimited)\" rồi lưu lại.");
        }
    }
}
