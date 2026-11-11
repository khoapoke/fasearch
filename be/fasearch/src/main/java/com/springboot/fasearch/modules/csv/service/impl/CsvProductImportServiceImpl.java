package com.springboot.fasearch.modules.csv.service.impl;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.exception.FieldErrorDetail;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.csv.CsvImportProduct;
import com.springboot.fasearch.modules.csv.CsvImportRowError;
import com.springboot.fasearch.modules.csv.CsvParser;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator.ExistingProduct;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator.ExistingSku;
import com.springboot.fasearch.modules.csv.CsvProductImportValidator.Lookups;
import com.springboot.fasearch.modules.csv.CsvWriter;
import com.springboot.fasearch.modules.csv.dto.response.CsvImportDraftRes;
import com.springboot.fasearch.modules.csv.dto.response.CsvImportRes;
import com.springboot.fasearch.modules.csv.service.interfaces.CsvProductImportService;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftVariantReq;
import com.springboot.fasearch.modules.publish.dto.response.AdminDraftRes;
import com.springboot.fasearch.modules.publish.entity.ProductDraft;
import com.springboot.fasearch.modules.publish.entity.ProductDraftVariant;
import com.springboot.fasearch.modules.publish.repository.ProductDraftRepository;
import com.springboot.fasearch.modules.publish.repository.ProductDraftVariantRepository;
import com.springboot.fasearch.modules.publish.service.interfaces.PublishService;
import com.springboot.fasearch.security.SecurityUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Product CSV import built on the existing draft flow: every planned product is created through
 * {@link PublishService#createDraft}, so the draft screens, versioning and publish path stay the
 * single path. Nothing is published, no inventory row is created and no AI sync is queued here.
 *
 * Apply protection: the dry run returns a SHA-256 of the raw file; apply requires that checksum
 * and re-validates the file inside the transaction while holding a transaction-scoped PostgreSQL
 * advisory lock. A changed file, a concurrent submit or a second submit of the same file therefore
 * fails with a conflict and writes nothing, without storing the file server-side.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CsvProductImportServiceImpl implements CsvProductImportService {

    public static final String SOURCE_KIND = "ADMIN_CSV";
    private static final String TEMPLATE_FILENAME = "mau-nhap-san-pham.csv";
    private static final Set<String> CSV_CONTENT_TYPES = Set.of(
            "text/csv", "application/csv", "application/vnd.ms-excel", "text/plain",
            "application/octet-stream");
    private static final String CHECKSUM_PATTERN = "(?i)[0-9a-f]{64}";

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductDraftRepository draftRepository;
    private final ProductDraftVariantRepository draftVariantRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final PublishService publishService;

    @Override
    @Transactional(readOnly = true)
    public CsvImportRes dryRun(MultipartFile file) {
        byte[] bytes = bytesOf(file);
        Validation validation = inspect(bytes);
        CsvProductImportValidator.Result result = validation.result();
        log.info("CSV product import dry run: {} rows, {} products, {} errors, file sha256 {}",
                result.totalRows(), result.products().size(), result.errorCount(),
                validation.checksum());
        return response(validation.checksum(), result, List.of());
    }

    @Override
    @Transactional
    public CsvImportRes apply(MultipartFile file, String expectedChecksum) {
        byte[] bytes = bytesOf(file);
        String checksum = sha256(bytes);
        if (expectedChecksum == null || !expectedChecksum.matches(CHECKSUM_PATTERN)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Thiếu mã kiểm tra của lần Kiểm tra. Bấm Kiểm tra lại trước khi nhập.");
        }
        if (!checksum.equalsIgnoreCase(expectedChecksum)) {
            throw new AppException(ErrorCode.DATA_CONFLICT,
                    "Tệp đã thay đổi kể từ lần kiểm tra. Bấm Kiểm tra lại rồi nhập.");
        }

        // Serialise concurrent applies; a second submit re-validates after the first commit and
        // then finds the drafts/barcodes it created, so it cannot create a duplicate.
        draftRepository.lockProductImport();
        Validation validation = inspect(bytes);
        CsvProductImportValidator.Result result = validation.result();
        if (result.errorCount() > 0) {
            throw new AppException(ErrorCode.DATA_CONFLICT,
                    "Không nhập được: tệp có " + result.errorCount()
                            + " lỗi hoặc dữ liệu vừa thay đổi từ lần kiểm tra. Chưa ghi dòng nào.",
                    toFieldErrors(result.errors()));
        }

        String actor = SecurityUtils.getCurrentUsername().orElse("unknown");
        List<CsvImportDraftRes> drafts = createDrafts(result.products(), checksum, actor);
        log.info("CSV product import applied: {} drafts, {} rows, file sha256 {}, actor {}",
                drafts.size(), result.totalRows(), checksum, actor);
        return response(checksum, result, drafts);
    }

    @Override
    public CsvTemplate template() {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try {
            CsvWriter writer = new CsvWriter(output);
            writer.row((Object[]) CsvProductImportValidator.HEADERS.toArray(new String[0]));
            writer.flush();
        } catch (IOException exception) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
        return new CsvTemplate(TEMPLATE_FILENAME, output.toByteArray());
    }

    private List<CsvImportDraftRes> createDrafts(List<CsvImportProduct> products, String checksum,
            String actor) {
        List<CsvImportDraftRes> created = new ArrayList<>();
        for (CsvImportProduct product : products) {
            AdminDraftCreateReq request = new AdminDraftCreateReq();
            request.setProductName(product.productName());
            request.setCategoryId(product.categoryId());
            request.setBrandId(product.brandId());
            request.setModelCode(product.modelCode());
            request.setMaterial(product.material());
            request.setStyle(product.style());
            request.setPrice(product.price());
            request.setSourceKind(SOURCE_KIND);
            request.setSourceUrl("csv-import://" + actor);
            request.setSourceHash(checksum);
            request.setVariants(variantsOf(product));
            AdminDraftRes draft = publishService.createDraft(request);
            created.add(new CsvImportDraftRes(draft.getDraftId(), draft.getProductName(),
                    product.variants().size()));
        }
        return created;
    }

    private static List<AdminDraftVariantReq> variantsOf(CsvImportProduct product) {
        List<AdminDraftVariantReq> variants = new ArrayList<>();
        for (CsvImportProduct.Variant source : product.variants()) {
            AdminDraftVariantReq variant = new AdminDraftVariantReq();
            variant.setColor(source.color());
            variant.setSize(source.size());
            variant.setBarcode(source.barcode());
            variant.setAdditionalPrice(source.additionalPrice());
            // Stock is intentionally left null: quantities belong to import receipts (D9).
            variant.setStock(null);
            variants.add(variant);
        }
        return variants;
    }

    private Validation inspect(byte[] bytes) {
        String checksum = sha256(bytes);
        List<CsvParser.Row> rows = CsvParser.parse(bytes);
        CsvProductImportValidator.Result result = CsvProductImportValidator.validate(rows, lookups());
        return new Validation(checksum, result);
    }

    private Lookups lookups() {
        Map<String, Category> categories = new HashMap<>();
        List<Category> categoryRows = categoryRepository.findAll();
        for (Category category : categoryRows) {
            categories.put(category.getCategoryName().strip(), category);
        }
        for (Category category : categoryRows) {
            categories.putIfAbsent(CsvProductImportValidator.nameKey(category.getCategoryName()),
                    category);
        }
        Map<String, Brand> brands = new HashMap<>();
        List<Brand> brandRows = brandRepository.findAllByIsDeletedFalseOrderByNameAsc();
        for (Brand brand : brandRows) {
            brands.put(brand.getName().strip(), brand);
        }
        for (Brand brand : brandRows) {
            brands.putIfAbsent(CsvProductImportValidator.nameKey(brand.getName()), brand);
        }

        Map<String, ExistingProduct> products = new HashMap<>();
        for (Object[] row : productRepository.findImportIdentityRows()) {
            Long id = ((Number) row[0]).longValue();
            String name = (String) row[1];
            Long categoryId = row[2] == null ? null : ((Number) row[2]).longValue();
            Long brandId = row[3] == null ? null : ((Number) row[3]).longValue();
            String model = (String) row[4];
            boolean deleted = Boolean.TRUE.equals(row[5]);
            if (categoryId == null || name == null) {
                continue;
            }
            String key = CsvProductImportValidator.productKey(categoryId, brandId, model, name);
            ExistingProduct current = products.get(key);
            if (current == null || (current.deleted() && !deleted)) {
                products.put(key, new ExistingProduct(id, deleted));
            }
        }

        Map<String, ExistingSku> skus = new HashMap<>();
        for (Object[] row : productVariantRepository.findImportBarcodeRows()) {
            Long id = ((Number) row[0]).longValue();
            String barcode = (String) row[1];
            boolean deleted = Boolean.TRUE.equals(row[2]);
            String key = CsvProductImportValidator.barcodeKey(barcode);
            ExistingSku current = skus.get(key);
            if (current == null || (current.deleted() && !deleted)) {
                skus.put(key, new ExistingSku(id, deleted));
            }
        }

        Map<String, Long> openDrafts = new HashMap<>();
        List<ProductDraft> drafts = draftRepository.findOpenWithCatalog("DRAFT");
        for (ProductDraft draft : drafts) {
            if (draft.getCategory() == null || draft.getProductName() == null) {
                continue;
            }
            String key = CsvProductImportValidator.productKey(draft.getCategory().getId(),
                    draft.getBrand() == null ? null : draft.getBrand().getId(),
                    draft.getModelCode(), draft.getProductName());
            openDrafts.putIfAbsent(key, draft.getId());
        }

        Map<String, Long> draftBarcodes = new HashMap<>();
        for (ProductDraftVariant variant : draftVariantRepository.findByDraft_DraftState("DRAFT")) {
            if (variant.getBarcode() == null || variant.getDraft() == null) {
                continue;
            }
            draftBarcodes.putIfAbsent(
                    CsvProductImportValidator.barcodeKey(variant.getBarcode()),
                    variant.getDraft().getId());
        }

        return new Lookups(categories, brands, products, skus, openDrafts, draftBarcodes);
    }

    private static byte[] bytesOf(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Chưa chọn tệp CSV.");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Chỉ nhận tệp có phần mở rộng .csv.");
        }
        String contentType = file.getContentType();
        if (contentType != null) {
            String mime = contentType.split(";")[0].strip().toLowerCase(Locale.ROOT);
            if (!mime.isEmpty() && !CSV_CONTENT_TYPES.contains(mime)) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Tệp không phải CSV. Chọn tệp .csv được lưu dưới dạng \"CSV UTF-8\".");
            }
        }
        if (file.getSize() > CsvProductImportValidator.MAX_FILE_BYTES) {
            throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE,
                    "Tệp vượt quá 5 MB. Chia nhỏ tệp rồi nhập lại.");
        }
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length == 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Tệp CSV trống. Tải tệp mẫu, điền dữ liệu rồi tải lên lại.");
            }
            return bytes;
        } catch (IOException exception) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private static List<FieldErrorDetail> toFieldErrors(List<CsvImportRowError> errors) {
        List<FieldErrorDetail> details = new ArrayList<>();
        for (CsvImportRowError error : errors) {
            String field = error.column() == null || error.column().isBlank()
                    ? "Dòng " + error.row()
                    : "Dòng " + error.row() + " · " + error.column();
            details.add(new FieldErrorDetail(field, error.message()));
        }
        return details;
    }

    private static CsvImportRes response(String checksum, CsvProductImportValidator.Result result,
            List<CsvImportDraftRes> drafts) {
        return new CsvImportRes(checksum, result.totalRows(), result.validRows(),
                drafts.isEmpty() ? result.products().size() : drafts.size(),
                result.errorCount(), result.truncated(), result.errors(), drafts);
    }

    private record Validation(String checksum, CsvProductImportValidator.Result result) {
    }
}
