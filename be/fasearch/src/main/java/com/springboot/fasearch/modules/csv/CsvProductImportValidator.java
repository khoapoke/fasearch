package com.springboot.fasearch.modules.csv;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.product.entity.Category;

/**
 * Validates a parsed product CSV against the catalogue and turns the clean rows into the products
 * (one draft each) that the apply step will create.
 *
 * Every problem is reported with the record number (header is row 1), the column name and a
 * Vietnamese message; a row with any problem is never written. Product identity is
 * (brand, model) when both are present — the same key as the catalogue unique index — otherwise
 * (category, normalised name). SKU identity is the barcode. Both are checked inside the file,
 * against published rows and against soft-deleted rows.
 */
public final class CsvProductImportValidator {

    public static final List<String> HEADERS = List.of(
            "Tên sản phẩm", "Danh mục", "Thương hiệu", "Model", "Chất liệu", "Kiểu dáng",
            "Giá bán", "Màu", "Cỡ", "Mã vạch", "Giá cộng thêm");

    public static final int MAX_ROWS = 10_000;
    public static final int MAX_ERRORS = 200;
    public static final long MAX_FILE_BYTES = 5L * 1024 * 1024;

    private static final BigDecimal MAX_MONEY = new BigDecimal("9999999999999.99");
    private static final String MONEY_HINT =
            "Không dùng dấu phân cách nghìn, tối đa 2 chữ số thập phân (ví dụ 150000).";

    public record ExistingProduct(long id, boolean deleted) {
    }

    public record ExistingSku(long id, boolean deleted) {
    }

    /** Everything the file is checked against, loaded once per validation run. */
    public record Lookups(
            Map<String, Category> categoriesByName,
            Map<String, Brand> brandsByName,
            Map<String, ExistingProduct> productsByKey,
            Map<String, ExistingSku> skusByBarcode,
            Map<String, Long> openDraftsByKey,
            Map<String, Long> openDraftVariantBarcodes) {
    }

    public record Result(
            int totalRows,
            int validRows,
            int errorCount,
            boolean truncated,
            List<CsvImportRowError> errors,
            List<CsvImportProduct> products) {
    }

    private CsvProductImportValidator() {
    }

    public static String nameKey(String value) {
        return value == null ? "" : value.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public static String barcodeKey(String value) {
        return value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
    }

    /**
     * Identity used both to group the rows of one product inside a file and to find a product or
     * open draft that would collide with it.
     */
    public static String productKey(Long categoryId, Long brandId, String modelCode,
            String productName) {
        String model = modelCode == null ? "" : modelCode.strip();
        if (brandId != null && !model.isEmpty()) {
            return "BM|" + brandId + "|" + model.toUpperCase(Locale.ROOT);
        }
        return "CN|" + categoryId + "|" + nameKey(productName);
    }

    public static Result validate(List<CsvParser.Row> rows, Lookups lookups) {
        if (rows.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tệp CSV trống. Tải tệp mẫu, điền dữ liệu rồi tải lên lại.");
        }
        Map<String, Integer> columns = headerIndex(rows.get(0));
        int totalRows = rows.size() - 1;
        if (totalRows == 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tệp không có dòng dữ liệu nào. Điền ít nhất một sản phẩm rồi tải lên lại.");
        }
        if (totalRows > MAX_ROWS) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tệp có " + totalRows + " dòng dữ liệu, vượt giới hạn 10.000 dòng."
                            + " Chia nhỏ tệp rồi nhập lại.");
        }

        List<CsvImportRowError> problems = new ArrayList<>();
        Set<Integer> rowsWithProblems = new HashSet<>();
        Map<String, Integer> barcodeFirstRow = new HashMap<>();
        Map<String, Integer> blockedProductKeys = new HashMap<>();
        Map<String, ProductBuilder> products = new LinkedHashMap<>();

        for (int index = 1; index < rows.size(); index++) {
            CsvParser.Row row = rows.get(index);
            if (row.values().size() != HEADERS.size()) {
                add(problems, rowsWithProblems, row.rowNumber(), "", "ROW_WIDTH",
                        "Dòng có " + row.values().size() + " cột, cần " + HEADERS.size()
                                + " cột theo tệp mẫu.");
                continue;
            }
            RowReader reader = new RowReader(row, columns, lookups, problems, rowsWithProblems);
            RowValues values = reader.read();

            if (values.barcode != null) {
                String key = barcodeKey(values.barcode);
                Integer firstRow = barcodeFirstRow.putIfAbsent(key, row.rowNumber());
                if (firstRow != null) {
                    reader.error("Mã vạch", "DUPLICATE_BARCODE_FILE",
                            "Mã vạch “" + values.barcode + "” bị trùng trong tệp (đã dùng ở dòng "
                                    + firstRow + ").");
                }
                ExistingSku existing = lookups.skusByBarcode().get(key);
                if (existing != null) {
                    reader.error("Mã vạch", "BARCODE_EXISTS",
                            "Mã vạch “" + values.barcode + "” đã thuộc SKU #" + existing.id()
                                    + (existing.deleted() ? " (SKU đã xóa mềm — hãy khôi phục SKU cũ)" : "")
                                    + ". Dùng mã vạch khác hoặc cập nhật SKU đó.");
                }
                Long draftId = lookups.openDraftVariantBarcodes().get(key);
                if (draftId != null) {
                    reader.error("Mã vạch", "BARCODE_IN_DRAFT",
                            "Mã vạch “" + values.barcode + "” đang dùng trong bản nháp #" + draftId
                                    + ". Hoàn tất hoặc xóa bản nháp đó trước khi nhập.");
                }
            }

            if (values.category != null && values.name != null && values.nameError == null) {
                String key = productKey(values.category.getId(), values.brandId, values.model,
                        values.name);
                Integer blockedAt = blockedProductKeys.get(key);
                if (blockedAt != null) {
                    // The collision is reported in full on the first row of the key; later rows get
                    // a short note so they are never counted as valid or as a product.
                    reader.error(key.startsWith("BM|") ? "Model" : "Tên sản phẩm",
                            "PRODUCT_ROW_BLOCKED",
                            "Dòng này thuộc sản phẩm đã bị chặn ở dòng " + blockedAt
                                    + "; sẽ không được nhập.");
                } else {
                    int before = problems.size();
                    String column = key.startsWith("BM|") ? "Model" : "Tên sản phẩm";
                    ExistingProduct existing = lookups.productsByKey().get(key);
                    if (existing != null) {
                        reader.error(column, "PRODUCT_EXISTS",
                                "Sản phẩm đã tồn tại (#" + existing.id() + ")"
                                        + (existing.deleted() ? " và đang ở thùng rác" : "")
                                        + ". Khôi phục hoặc cập nhật sản phẩm đó thay vì nhập mới.");
                    }
                    Long draftId = lookups.openDraftsByKey().get(key);
                    if (draftId != null) {
                        reader.error(column, "PRODUCT_IN_DRAFT",
                                "Sản phẩm này đã có bản nháp đang mở (#" + draftId
                                        + "). Mở bản nháp đó để tiếp tục; tệp không được nhập lại"
                                        + " để tránh trùng.");
                    }
                    if (problems.size() > before) {
                        blockedProductKeys.put(key, row.rowNumber());
                    }
                }
            }

            if (!rowsWithProblems.contains(row.rowNumber()) && values.isComplete()) {
                addToProduct(products, values, row.rowNumber(), reader);
            }
        }

        List<CsvImportProduct> planned = new ArrayList<>();
        for (ProductBuilder builder : products.values()) {
            if (!builder.variants.isEmpty()) {
                planned.add(builder.build());
            }
        }

        int validRows = Math.max(0, totalRows - rowsWithProblems.size());
        boolean truncated = problems.size() > MAX_ERRORS;
        List<CsvImportRowError> capped = truncated
                ? List.copyOf(problems.subList(0, MAX_ERRORS))
                : List.copyOf(problems);
        return new Result(totalRows, validRows, problems.size(), truncated, capped, planned);
    }

    private static void addToProduct(Map<String, ProductBuilder> products, RowValues values,
            int rowNumber, RowReader reader) {
        String key = productKey(values.category.getId(), values.brandId, values.model, values.name);
        ProductBuilder builder = products.get(key);
        if (builder == null) {
            builder = new ProductBuilder(key, values);
            products.put(key, builder);
        } else {
            String conflicting = builder.firstDifference(values);
            if (conflicting != null) {
                reader.error(conflicting, "TEXT_MISMATCH",
                        "Các dòng của cùng một sản phẩm phải giống nhau ở cột “" + conflicting
                                + "” (dòng " + builder.firstRow + " khai báo trước).");
                return;
            }
        }
        String combination = combinationKey(values.color, values.size);
        if (!"|".equals(combination)) {
            Integer previousRow = builder.combinations.putIfAbsent(combination, rowNumber);
            if (previousRow != null) {
                reader.error(values.color == null ? "Cỡ" : "Màu", "DUPLICATE_COMBINATION",
                        "Tổ hợp màu/cỡ “" + displayCombination(values.color, values.size)
                                + "” bị trùng trong cùng sản phẩm (dòng " + previousRow + ").");
                return;
            }
        }
        builder.variants.add(new CsvImportProduct.Variant(
                values.color, values.size, values.barcode, values.extraPrice));
    }

    private static String displayCombination(String color, String size) {
        return (color == null ? "" : color) + "/" + (size == null ? "" : size);
    }

    private static String combinationKey(String color, String size) {
        return norm(color) + "|" + norm(size);
    }

    private static String norm(String value) {
        return value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
    }

    private static void add(List<CsvImportRowError> problems, Set<Integer> rowsWithProblems,
            int row, String column, String code, String message) {
        rowsWithProblems.add(row);
        problems.add(new CsvImportRowError(row, column, code, message));
    }

    static Map<String, Integer> headerIndex(CsvParser.Row header) {
        Map<String, Integer> index = new LinkedHashMap<>();
        List<String> issues = new ArrayList<>();
        for (int position = 0; position < header.values().size(); position++) {
            String name = header.values().get(position).strip();
            if (name.isEmpty()) {
                issues.add("cột " + (position + 1) + " không có tên");
                continue;
            }
            if (!HEADERS.contains(name)) {
                issues.add("cột không hỗ trợ “" + name + "”");
                continue;
            }
            if (index.putIfAbsent(name, position) != null) {
                issues.add("cột “" + name + "” bị lặp");
            }
        }
        List<String> missing = HEADERS.stream().filter(head -> !index.containsKey(head)).toList();
        if (!missing.isEmpty()) {
            List<String> quoted = new ArrayList<>();
            for (String head : missing) {
                quoted.add("“" + head + "”");
            }
            issues.add("thiếu cột " + String.join(", ", quoted));
        }
        if (!issues.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Tiêu đề tệp chưa đúng: " + String.join("; ", issues)
                            + ". Tải tệp mẫu để dùng đúng " + HEADERS.size() + " cột.");
        }
        return index;
    }

    private static boolean formulaTrigger(char value) {
        return value == '=' || value == '+' || value == '-' || value == '@'
                || value == '\t' || value == '\r' || value == '\n';
    }

    /** Reverse the apostrophe our export adds in front of formula-like text; other text is data. */
    static String text(String raw) {
        String value = raw == null ? "" : raw.strip();
        if (value.length() > 1 && value.charAt(0) == '\'' && formulaTrigger(value.charAt(1))) {
            return value.substring(1);
        }
        return value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    private static BigDecimal money(String raw) {
        if (!raw.matches("-?\\d+(\\.\\d{1,2})?")) {
            return null;
        }
        return new BigDecimal(raw);
    }

    private static final class RowValues {
        int rowNumber;
        String name;
        String nameError;
        Category category;
        String categoryName;
        String brandName;
        Long brandId;
        String model;
        String material;
        String style;
        BigDecimal price;
        String color;
        String size;
        String barcode;
        BigDecimal extraPrice;

        boolean isComplete() {
            return category != null && price != null && extraPrice != null;
        }
    }

    private static final class RowReader {
        private final CsvParser.Row row;
        private final Map<String, Integer> columns;
        private final Lookups lookups;
        private final List<CsvImportRowError> problems;
        private final Set<Integer> rowsWithProblems;

        RowReader(CsvParser.Row row, Map<String, Integer> columns, Lookups lookups,
                List<CsvImportRowError> problems, Set<Integer> rowsWithProblems) {
            this.row = row;
            this.columns = columns;
            this.lookups = lookups;
            this.problems = problems;
            this.rowsWithProblems = rowsWithProblems;
        }

        String cell(String column) {
            return text(row.values().get(columns.get(column)));
        }

        void error(String column, String code, String message) {
            add(problems, rowsWithProblems, row.rowNumber(), column, code, message);
        }

        RowValues read() {
            RowValues values = new RowValues();
            values.rowNumber = row.rowNumber();

            values.name = blankToNull(cell("Tên sản phẩm"));
            if (values.name == null) {
                error("Tên sản phẩm", "REQUIRED", "Tên sản phẩm là bắt buộc.");
                values.nameError = "REQUIRED";
            } else if (values.name.length() > 255) {
                error("Tên sản phẩm", "TOO_LONG", "Tên sản phẩm tối đa 255 ký tự.");
                values.nameError = "TOO_LONG";
            }

            values.categoryName = blankToNull(cell("Danh mục"));
            if (values.categoryName == null) {
                error("Danh mục", "REQUIRED", "Danh mục là bắt buộc.");
            } else {
                values.category = lookups.categoriesByName().get(values.categoryName);
                if (values.category == null) {
                    values.category = lookups.categoriesByName().get(nameKey(values.categoryName));
                }
                if (values.category == null) {
                    error("Danh mục", "CATEGORY_NOT_FOUND",
                            "Danh mục “" + values.categoryName + "” không tồn tại."
                                    + " Tạo danh mục trước rồi nhập lại.");
                }
            }

            values.brandName = blankToNull(cell("Thương hiệu"));
            if (values.brandName != null) {
                Brand brand = lookups.brandsByName().get(values.brandName);
                if (brand == null) {
                    brand = lookups.brandsByName().get(nameKey(values.brandName));
                }
                if (brand == null) {
                    error("Thương hiệu", "BRAND_NOT_FOUND",
                            "Thương hiệu “" + values.brandName + "” không tồn tại."
                                    + " Tạo thương hiệu trước rồi nhập lại.");
                } else {
                    values.brandId = brand.getId();
                }
            }

            values.model = bounded(values, "Model", 100);
            values.material = bounded(values, "Chất liệu", 100);
            values.style = bounded(values, "Kiểu dáng", 100);

            String price = cell("Giá bán");
            if (price.isEmpty()) {
                error("Giá bán", "REQUIRED", "Giá bán là bắt buộc.");
            } else {
                BigDecimal parsed = money(price);
                if (parsed == null) {
                    error("Giá bán", "INVALID_NUMBER", "Giá bán phải là số không âm. " + MONEY_HINT);
                } else if (parsed.signum() < 0) {
                    error("Giá bán", "NEGATIVE_NUMBER", "Giá bán không được âm.");
                } else if (parsed.compareTo(MAX_MONEY) > 0) {
                    error("Giá bán", "TOO_LARGE", "Giá bán vượt quá giới hạn cho phép.");
                } else {
                    values.price = parsed;
                }
            }

            values.color = bounded(values, "Màu", 50);
            values.size = bounded(values, "Cỡ", 50);
            values.barcode = bounded(values, "Mã vạch", 100);
            if (values.color == null && values.size == null && values.barcode == null) {
                error("Màu", "VARIANT_REQUIRED",
                        "Mỗi dòng cần ít nhất một trong Màu, Cỡ hoặc Mã vạch để tạo SKU.");
            }

            String extra = cell("Giá cộng thêm");
            if (extra.isEmpty()) {
                values.extraPrice = BigDecimal.ZERO;
            } else {
                BigDecimal parsed = money(extra);
                if (parsed == null) {
                    error("Giá cộng thêm", "INVALID_NUMBER",
                            "Giá cộng thêm phải là số không âm. " + MONEY_HINT);
                } else if (parsed.signum() < 0) {
                    error("Giá cộng thêm", "NEGATIVE_NUMBER", "Giá cộng thêm không được âm.");
                } else if (parsed.compareTo(MAX_MONEY) > 0) {
                    error("Giá cộng thêm", "TOO_LARGE",
                            "Giá cộng thêm vượt quá giới hạn cho phép.");
                } else {
                    values.extraPrice = parsed;
                }
            }
            return values;
        }

        private String bounded(RowValues values, String column, int max) {
            String value = blankToNull(cell(column));
            if (value != null && value.length() > max) {
                error(column, "TOO_LONG", column + " tối đa " + max + " ký tự.");
                return null;
            }
            return value;
        }
    }

    private static final class ProductBuilder {
        private final String key;
        private final String productName;
        private final Long categoryId;
        private final Long brandId;
        private final String modelCode;
        private final String material;
        private final String style;
        private final BigDecimal price;
        private final String brandName;
        private final String categoryName;
        private final int firstRow;
        private final Map<String, Integer> combinations = new HashMap<>();
        private final List<CsvImportProduct.Variant> variants = new ArrayList<>();

        ProductBuilder(String key, RowValues values) {
            this.key = key;
            this.productName = values.name;
            this.categoryId = values.category.getId();
            this.brandId = values.brandId;
            this.modelCode = values.model;
            this.material = values.material;
            this.style = values.style;
            this.price = values.price;
            this.brandName = values.brandName;
            this.categoryName = values.categoryName;
            this.firstRow = values.rowNumber;
        }

        String firstDifference(RowValues values) {
            if (!productName.equals(values.name)) {
                return "Tên sản phẩm";
            }
            if (!categoryName.equals(values.categoryName)) {
                return "Danh mục";
            }
            if (!equal(brandName, values.brandName)) {
                return "Thương hiệu";
            }
            if (!equal(modelCode, values.model)) {
                return "Model";
            }
            if (!equal(material, values.material)) {
                return "Chất liệu";
            }
            if (!equal(style, values.style)) {
                return "Kiểu dáng";
            }
            if (price.compareTo(values.price) != 0) {
                return "Giá bán";
            }
            return null;
        }

        private static boolean equal(String left, String right) {
            return left == null ? right == null : left.equals(right);
        }

        CsvImportProduct build() {
            return new CsvImportProduct(key, productName, categoryId, brandId, modelCode, material,
                    style, price, List.copyOf(variants));
        }
    }
}
