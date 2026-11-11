package com.springboot.fasearch.modules.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator.ExistingProduct;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator.ExistingSku;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator.Lookups;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator.Result;
import com.springboot.fasearch.modules.product.entity.Category;

class CsvProductImportValidatorTest {

    private static final Category CATEGORY = Category.builder().id(1L).categoryName("Áo thơm").build();
    private static final Brand BRAND = Brand.builder().id(2L).name("Adidas").slug("adidas").build();

    private static CsvParser.Row header() {
        return new CsvParser.Row(1, CsvProductImportValidator.HEADERS);
    }

    private static CsvParser.Row row(int number, String... values) {
        return new CsvParser.Row(number, List.of(values));
    }

    private static CsvParser.Row validRow(int number) {
        return row(number, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                "150000", "Đen", "M", "893000000001", "0");
    }

    private static Lookups lookups(Map<String, ExistingProduct> products,
            Map<String, ExistingSku> skus, Map<String, Long> drafts, Map<String, Long> draftBarcodes) {
        return new Lookups(
                Map.of(CsvProductImportValidator.nameKey("Áo thơm"), CATEGORY),
                Map.of(CsvProductImportValidator.nameKey("Adidas"), BRAND),
                products, skus, drafts, draftBarcodes);
    }

    private static Lookups emptyLookups() {
        return lookups(Map.of(), Map.of(), Map.of(), Map.of());
    }

    @Test
    void acceptsACompleteRowAndKeepsTheVariant() {
        Result result = CsvProductImportValidator.validate(List.of(header(), validRow(2)),
                emptyLookups());

        assertEquals(1, result.totalRows());
        assertEquals(1, result.validRows());
        assertEquals(0, result.errorCount());
        assertEquals(1, result.products().size());
        CsvImportProduct product = result.products().get(0);
        assertEquals("Áo thơm", product.productName());
        assertEquals(1L, product.categoryId());
        assertEquals(2L, product.brandId());
        assertEquals(new BigDecimal("150000"), product.price());
        assertEquals(1, product.variants().size());
        assertEquals("893000000001", product.variants().get(0).barcode());
        assertEquals(BigDecimal.ZERO, product.variants().get(0).additionalPrice());
    }

    @Test
    void reportsEveryRequiredAndTypeError() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                row(2, "", "", "Không có", "", "", "", "abc", "", "", "", "xyz")),
                emptyLookups());

        assertEquals(1, result.totalRows());
        assertEquals(0, result.validRows());
        assertTrue(result.errors().stream().anyMatch(e -> e.column().equals("Tên sản phẩm")
                && e.code().equals("REQUIRED")));
        assertTrue(result.errors().stream().anyMatch(e -> e.column().equals("Danh mục")
                && e.code().equals("REQUIRED")));
        assertTrue(result.errors().stream().anyMatch(e -> e.code().equals("BRAND_NOT_FOUND")));
        assertTrue(result.errors().stream().anyMatch(e -> e.code().equals("INVALID_NUMBER")));
        assertTrue(result.errors().stream().anyMatch(e -> e.code().equals("VARIANT_REQUIRED")));
        assertTrue(result.products().isEmpty());
    }

    @Test
    void rejectsNegativeAndThousandSeparatedPrices() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                row(2, "Áo thơm", "Áo thơm", "", "", "", "", "-5", "Đen", "M", "", ""),
                row(3, "Áo thơm", "Áo thơm", "", "", "", "", "150.000", "Đỏ", "L", "", "")),
                emptyLookups());

        assertTrue(result.errors().stream().anyMatch(e -> e.row() == 2
                && e.code().equals("NEGATIVE_NUMBER")));
        assertTrue(result.errors().stream().anyMatch(e -> e.row() == 3
                && e.code().equals("INVALID_NUMBER")));
    }

    @Test
    void enforcesLengthsOfNameAndVariantColumns() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                row(2, "a".repeat(256), "Áo thơm", "", "", "c".repeat(101), "s".repeat(101),
                        "1", "m".repeat(51), "s".repeat(51), "b".repeat(101), "")),
                emptyLookups());

        assertTrue(result.errors().stream().anyMatch(e -> e.column().equals("Tên sản phẩm")
                && e.code().equals("TOO_LONG")));
        assertTrue(result.errors().stream().anyMatch(e -> e.column().equals("Chất liệu")));
        assertTrue(result.errors().stream().anyMatch(e -> e.column().equals("Màu")));
        assertTrue(result.errors().stream().anyMatch(e -> e.column().equals("Mã vạch")));
    }

    @Test
    void groupsTwoRowsOfOneProductIntoOneDraft() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                validRow(2),
                row(3, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150000", "Trắng", "L", "893000000002", "10000")),
                emptyLookups());

        assertEquals(0, result.errorCount());
        assertEquals(2, result.validRows());
        assertEquals(1, result.products().size());
        assertEquals(2, result.products().get(0).variants().size());
        assertEquals(new BigDecimal("10000"),
                result.products().get(0).variants().get(1).additionalPrice());
    }

    @Test
    void refusesRowsOfOneProductThatDifferInPriceOrName() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                validRow(2),
                row(3, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150001", "Trắng", "L", "893000000002", "0")),
                emptyLookups());

        assertEquals(1, result.errorCount());
        assertTrue(result.errors().get(0).message().contains("Giá bán"));
        assertEquals(1, result.validRows());
    }

    @Test
    void refusesDuplicateColorSizeInsideOneProduct() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                validRow(2),
                row(3, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150000", "đen", "m", "893000000002", "0")),
                emptyLookups());

        assertEquals(1, result.errorCount());
        assertEquals("DUPLICATE_COMBINATION", result.errors().get(0).code());
    }

    @Test
    void refusesDuplicateBarcodeInsideTheFile() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                validRow(2),
                row(3, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150000", "Trắng", "L", "893000000001", "0")),
                emptyLookups());

        assertTrue(result.errors().stream().anyMatch(e -> e.row() == 3
                && e.code().equals("DUPLICATE_BARCODE_FILE")));
        assertEquals(1, result.validRows());
        assertEquals(1, result.products().size());
    }

    @Test
    void refusesBarcodesThatBelongToLiveOrSoftDeletedSkus() {
        ExistingSku deleted = new ExistingSku(77L, true);
        Lookups lookups = lookups(Map.of(), Map.of("893000000001", deleted), Map.of(), Map.of());
        Result result = CsvProductImportValidator.validate(List.of(header(), validRow(2)), lookups);

        assertEquals(1, result.errorCount());
        assertEquals("BARCODE_EXISTS", result.errors().get(0).code());
        assertTrue(result.errors().get(0).message().contains("xóa mềm"));
    }

    @Test
    void refusesBarcodesHeldByAnOpenDraft() {
        Lookups lookups = lookups(Map.of(), Map.of(), Map.of(),
                Map.of("893000000001", 42L));
        Result result = CsvProductImportValidator.validate(List.of(header(), validRow(2)), lookups);

        assertEquals("BARCODE_IN_DRAFT", result.errors().get(0).code());
        assertTrue(result.errors().get(0).message().contains("#42"));
    }

    @Test
    void refusesProductsThatAlreadyExistIncludingSoftDeletedOnes() {
        String key = CsvProductImportValidator.productKey(1L, 2L, "M1", "Áo thơm");
        Lookups lookups = lookups(Map.of(key, new ExistingProduct(15L, true)),
                Map.of(), Map.of(), Map.of());
        Result result = CsvProductImportValidator.validate(List.of(header(), validRow(2)), lookups);

        assertEquals("PRODUCT_EXISTS", result.errors().get(0).code());
        assertTrue(result.errors().get(0).message().contains("#15"));
        assertTrue(result.errors().get(0).message().contains("thùng rác"));
    }

    @Test
    void refusesProductsWithAnOpenDraftSoTheSameFileCannotBeImportedTwice() {
        String key = CsvProductImportValidator.productKey(1L, 2L, "M1", "Áo thơm");
        Lookups lookups = lookups(Map.of(), Map.of(), Map.of(key, 9L), Map.of());
        Result result = CsvProductImportValidator.validate(List.of(header(), validRow(2)), lookups);

        assertEquals("PRODUCT_IN_DRAFT", result.errors().get(0).code());
        assertTrue(result.errors().get(0).message().contains("#9"));
        assertTrue(result.products().isEmpty());
    }

    @Test
    void laterRowsOfAnExistingProductAreNotCountedAsValidOrAsAProduct() {
        String key = CsvProductImportValidator.productKey(1L, 2L, "M1", "Áo thơm");
        Lookups lookups = lookups(Map.of(key, new ExistingProduct(15L, false)),
                Map.of(), Map.of(), Map.of());
        Result result = CsvProductImportValidator.validate(List.of(header(),
                row(2, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150000", "Đen", "M", "", "0"),
                row(3, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150000", "Đen", "L", "", "0"),
                row(4, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150000", "Trắng", "M", "", "0")), lookups);

        assertEquals(3, result.totalRows());
        assertEquals(0, result.validRows());
        assertEquals(3, result.errorCount());
        assertEquals("PRODUCT_EXISTS", result.errors().get(0).code());
        assertEquals("PRODUCT_ROW_BLOCKED", result.errors().get(1).code());
        assertEquals("PRODUCT_ROW_BLOCKED", result.errors().get(2).code());
        assertTrue(result.products().isEmpty());
    }

    @Test
    void laterRowsOfAProductWithAnOpenDraftAreBlockedToo() {
        String key = CsvProductImportValidator.productKey(1L, 2L, "M1", "Áo thơm");
        Lookups lookups = lookups(Map.of(), Map.of(), Map.of(key, 9L), Map.of());
        Result result = CsvProductImportValidator.validate(List.of(header(),
                validRow(2),
                row(3, "Áo thơm", "Áo thơm", "Adidas", "M1", "Cotton", "Regular",
                        "150000", "Đen", "L", "", "0")), lookups);

        assertEquals(0, result.validRows());
        assertEquals(0, result.products().size());
        assertEquals("PRODUCT_IN_DRAFT", result.errors().get(0).code());
        assertEquals("PRODUCT_ROW_BLOCKED", result.errors().get(1).code());
    }

    @Test
    void stripsTheExportApostropheFromFormulaTextButKeepsTheTextAsData() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                row(2, "'=1+1", "Áo thơm", "", "", "", "", "1", "", "M", "", ""),
                row(3, "<b>Kim loại</b>", "Áo thơm", "", "", "", "", "1", "", "L", "", "")),
                emptyLookups());

        assertEquals(0, result.errorCount());
        assertEquals("=1+1", result.products().get(0).productName());
        assertEquals("<b>Kim loại</b>", result.products().get(1).productName());
    }

    @Test
    void reportsRowWidthMismatch() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                row(2, "Áo thơm", "Áo thơm")), emptyLookups());

        assertEquals(1, result.errorCount());
        assertEquals("ROW_WIDTH", result.errors().get(0).code());
        assertEquals("", result.errors().get(0).column());
    }

    @Test
    void capsTheReturnedErrorsButKeepsTheRealCount() {
        List<CsvParser.Row> rows = new ArrayList<>();
        rows.add(header());
        for (int index = 0; index < 201; index++) {
            rows.add(row(index + 2, "", "Áo thơm", "", "", "", "", "1", "", "M", "", ""));
        }
        Result result = CsvProductImportValidator.validate(rows, emptyLookups());

        assertEquals(201, result.errorCount());
        assertEquals(200, result.errors().size());
        assertTrue(result.truncated());
        assertEquals(0, result.validRows());
    }

    @Test
    void rejectsUnknownMissingAndDuplicateHeaders() {
        List<String> unknown = new ArrayList<>(CsvProductImportValidator.HEADERS);
        unknown.add("Mã sản phẩm");
        AppException failure = assertThrows(AppException.class,
                () -> CsvProductImportValidator.validate(List.of(
                        new CsvParser.Row(1, unknown), validRow(2)), emptyLookups()));
        assertTrue(failure.getMessage().contains("không hỗ trợ"));

        AppException missing = assertThrows(AppException.class,
                () -> CsvProductImportValidator.validate(List.of(
                        new CsvParser.Row(1, CsvProductImportValidator.HEADERS.subList(0, 5)),
                        validRow(2)), emptyLookups()));
        assertTrue(missing.getMessage().contains("thiếu cột"));

        List<String> duplicated = new ArrayList<>(CsvProductImportValidator.HEADERS);
        duplicated.set(duplicated.size() - 1, "Màu");
        AppException duplicate = assertThrows(AppException.class,
                () -> CsvProductImportValidator.validate(List.of(
                        new CsvParser.Row(1, duplicated), validRow(2)), emptyLookups()));
        assertTrue(duplicate.getMessage().contains("bị lặp"));
    }

    @Test
    void refusesHeaderOnlyFilesAndFilesOverTheRowCap() {
        AppException headerOnly = assertThrows(AppException.class,
                () -> CsvProductImportValidator.validate(List.of(header()), emptyLookups()));
        assertTrue(headerOnly.getMessage().contains("không có dòng dữ liệu"));

        List<CsvParser.Row> rows = new ArrayList<>();
        rows.add(header());
        for (int index = 0; index < CsvProductImportValidator.MAX_ROWS + 1; index++) {
            rows.add(validRow(index + 2));
        }
        AppException tooMany = assertThrows(AppException.class,
                () -> CsvProductImportValidator.validate(rows, emptyLookups()));
        assertTrue(tooMany.getMessage().contains("10.000"));
    }

    @Test
    void barcodeOnlyRowsAreAllowedAndNotTreatedAsOneCombination() {
        Result result = CsvProductImportValidator.validate(List.of(header(),
                row(2, "Áo thơm", "Áo thơm", "", "", "", "", "1", "", "", "A1", ""),
                row(3, "Áo thơm", "Áo thơm", "", "", "", "", "1", "", "", "A2", "")),
                emptyLookups());

        assertEquals(0, result.errorCount());
        assertEquals(2, result.products().get(0).variants().size());
        assertFalse(result.truncated());
    }
}
