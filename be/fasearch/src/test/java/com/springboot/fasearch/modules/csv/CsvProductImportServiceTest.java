package com.springboot.fasearch.modules.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.csv.dto.response.CsvImportRes;
import com.springboot.fasearch.modules.csv.service.impl.CsvProductImportServiceImpl;
import com.springboot.fasearch.modules.csv.service.interfaces.CsvProductImportService;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.response.AdminDraftRes;
import com.springboot.fasearch.modules.publish.entity.ProductDraft;
import com.springboot.fasearch.modules.publish.entity.ProductDraftVariant;
import com.springboot.fasearch.modules.publish.repository.ProductDraftRepository;
import com.springboot.fasearch.modules.publish.repository.ProductDraftVariantRepository;
import com.springboot.fasearch.modules.publish.service.interfaces.PublishService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CsvProductImportServiceTest {

    private static final Category CATEGORY = Category.builder().id(1L).categoryName("Áo thơm").build();
    private static final Category CATEGORY_TWO = Category.builder().id(3L).categoryName("Quần jean").build();
    private static final Brand BRAND = Brand.builder().id(2L).name("Adidas").slug("adidas").build();

    @Mock private ProductRepository productRepository;
    @Mock private ProductVariantRepository productVariantRepository;
    @Mock private ProductDraftRepository draftRepository;
    @Mock private ProductDraftVariantRepository draftVariantRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private BrandRepository brandRepository;
    @Mock private PublishService publishService;

    private CsvProductImportServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CsvProductImportServiceImpl(productRepository, productVariantRepository,
                draftRepository, draftVariantRepository, categoryRepository, brandRepository,
                publishService);
        when(categoryRepository.findAll()).thenReturn(List.of(CATEGORY, CATEGORY_TWO));
        when(brandRepository.findAllByIsDeletedFalseOrderByNameAsc()).thenReturn(List.of(BRAND));
        when(productRepository.findImportIdentityRows()).thenReturn(List.of());
        when(productVariantRepository.findImportBarcodeRows()).thenReturn(List.of());
        when(draftRepository.findOpenWithCatalog("DRAFT")).thenReturn(List.of());
        when(draftVariantRepository.findByDraft_DraftState("DRAFT")).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static MockMultipartFile csv(String... rows) {
        StringBuilder text = new StringBuilder(
                String.join(",", CsvProductImportValidator.HEADERS)).append("\r\n");
        for (String row : rows) {
            text.append(row).append("\r\n");
        }
        return new MockMultipartFile("file", "san-pham.csv", "text/csv",
                text.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String row(String name, String category, String color, String size, String barcode) {
        return String.join(",", name, category, "Adidas", "M-" + name, "Cotton", "Regular",
                "150000", color, size, barcode, "0");
    }

    @Test
    void dryRunValidatesWithoutWritingAnything() {
        CsvImportRes result = service.dryRun(csv(row("Áo thơm", "Áo thơm", "Đen", "M", "893000000001")));

        assertEquals(0, result.errorCount());
        assertEquals(1, result.validRows());
        assertEquals(1, result.productCount());
        assertEquals(64, result.checksum().length());
        assertTrue(result.drafts().isEmpty());
        verify(publishService, never()).createDraft(any());
        verify(draftRepository, never()).save(any());
        verify(draftVariantRepository, never()).save(any());
        verify(productVariantRepository, never()).save(any());
    }

    @Test
    void applyCreatesOneDraftPerProductThroughTheExistingFlow() {
        MockMultipartFile file = csv(
                row("Áo thơm", "Áo thơm", "Đen", "M", "893000000001"),
                row("Quần jean", "Quần jean", "Xanh", "L", "893000000002"));
        CsvImportRes dry = service.dryRun(file);
        assertEquals(2, dry.productCount());
        when(publishService.createDraft(any()))
                .thenReturn(AdminDraftRes.builder().draftId(101L).productName("Áo thơm").build())
                .thenReturn(AdminDraftRes.builder().draftId(102L).productName("Quần jean").build());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("nhanvien01", null, List.of()));

        CsvImportRes applied = service.apply(file, dry.checksum());

        assertEquals(2, applied.drafts().size());
        assertEquals(101L, applied.drafts().get(0).draftId());
        assertEquals(0, applied.errorCount());
        verify(draftRepository).lockProductImport();
        ArgumentCaptor<AdminDraftCreateReq> captor =
                ArgumentCaptor.forClass(AdminDraftCreateReq.class);
        verify(publishService, times(2)).createDraft(captor.capture());
        AdminDraftCreateReq first = captor.getAllValues().get(0);
        assertEquals("ADMIN_CSV", first.getSourceKind());
        assertEquals("csv-import://nhanvien01", first.getSourceUrl());
        assertEquals(dry.checksum(), first.getSourceHash());
        assertNull(first.getImageUrl());
        assertNull(first.getVariants().get(0).getStock());
        verifyNoMoreInteractions(publishService);
        verify(productVariantRepository, never()).save(any());
        verify(draftVariantRepository, never()).save(any());
    }

    @Test
    void applyWithoutTheDryRunChecksumIsRefused() {
        AppException failure = assertThrows(AppException.class,
                () -> service.apply(csv(row("Áo thơm", "Áo thơm", "Đen", "M", "893000000001")), null));
        assertEquals(ErrorCode.INVALID_REQUEST, failure.getErrorCode());
        verify(publishService, never()).createDraft(any());
    }

    @Test
    void applyWithAStaleChecksumIsRefused() {
        AppException failure = assertThrows(AppException.class, () -> service.apply(
                csv(row("Áo thơm", "Áo thơm", "Đen", "M", "893000000001")), "a".repeat(64)));
        assertEquals(ErrorCode.DATA_CONFLICT, failure.getErrorCode());
        verify(publishService, never()).createDraft(any());
        verify(draftRepository, never()).lockProductImport();
    }

    @Test
    void applyRevalidatesAndRefusesAFileThatHasErrors() {
        MockMultipartFile file = csv(
                row("Áo thơm", "Áo thơm", "Đen", "M", "893000000001"),
                row("Áo thơm", "Áo thơm", "Trắng", "L", "893000000001"));
        CsvImportRes dry = service.dryRun(file);
        assertEquals(1, dry.errorCount());

        AppException failure = assertThrows(AppException.class,
                () -> service.apply(file, dry.checksum()));

        assertEquals(ErrorCode.DATA_CONFLICT, failure.getErrorCode());
        assertTrue(failure.getMessage().contains("Chưa ghi dòng nào"));
        verify(publishService, never()).createDraft(any());
    }

    @Test
    void aSecondApplyOfTheSameFileIsRefusedAfterTheFirstCommit() {
        MockMultipartFile file = csv(row("Áo thơm", "Áo thơm", "Đen", "M", "893000000001"));
        CsvImportRes dry = service.dryRun(file);
        ProductDraft draft = ProductDraft.builder().id(9L).productName("Áo thơm")
                .category(CATEGORY).brand(BRAND).modelCode("M-Áo thơm").draftState("DRAFT").build();
        when(draftRepository.findOpenWithCatalog("DRAFT")).thenReturn(List.of(draft));
        when(draftVariantRepository.findByDraft_DraftState("DRAFT")).thenReturn(List.of(
                ProductDraftVariant.builder().draft(draft).barcode("893000000001").build()));

        AppException failure = assertThrows(AppException.class,
                () -> service.apply(file, dry.checksum()));

        assertEquals(ErrorCode.DATA_CONFLICT, failure.getErrorCode());
        assertTrue(failure.getErrors().stream().anyMatch(error ->
                error.getReason().contains("đã có bản nháp đang mở")));
        verify(publishService, never()).createDraft(any());
    }

    @Test
    void applyStopsAndPropagatesWhenCreatingADraftFails() {
        MockMultipartFile file = csv(
                row("Áo thơm", "Áo thơm", "Đen", "M", "893000000001"),
                row("Quần jean", "Quần jean", "Xanh", "L", "893000000002"));
        CsvImportRes dry = service.dryRun(file);
        when(publishService.createDraft(any()))
                .thenReturn(AdminDraftRes.builder().draftId(101L).productName("Áo thơm").build())
                .thenThrow(new AppException(ErrorCode.DATA_CONFLICT, "boom"));

        assertThrows(AppException.class, () -> service.apply(file, dry.checksum()));

        verify(publishService, times(2)).createDraft(any());
        verify(draftVariantRepository, never()).save(any());
    }

    @Test
    void refusesFilesOverFiveMegabytes() {
        byte[] bytes = new byte[(int) CsvProductImportValidator.MAX_FILE_BYTES + 1];
        MockMultipartFile file = new MockMultipartFile("file", "big.csv", "text/csv", bytes);

        AppException failure = assertThrows(AppException.class, () -> service.dryRun(file));
        assertEquals(ErrorCode.PAYLOAD_TOO_LARGE, failure.getErrorCode());
        assertTrue(failure.getMessage().contains("5 MB"));
    }

    @Test
    void refusesNonCsvExtensionOrContentType() {
        MockMultipartFile wrongName = new MockMultipartFile("file", "data.txt", "text/csv",
                "A\r\n1\r\n".getBytes(StandardCharsets.UTF_8));
        AppException extension = assertThrows(AppException.class, () -> service.dryRun(wrongName));
        assertTrue(extension.getMessage().contains(".csv"));

        MockMultipartFile wrongType = new MockMultipartFile("file", "data.csv", "application/pdf",
                "A\r\n1\r\n".getBytes(StandardCharsets.UTF_8));
        AppException type = assertThrows(AppException.class, () -> service.dryRun(wrongType));
        assertTrue(type.getMessage().contains("CSV"));
    }

    @Test
    void refusesNonUtf8BytesWithTheExcelHint() {
        MockMultipartFile file = new MockMultipartFile("file", "data.csv", "text/csv",
                new byte[] {'A', ',', 'B', '\r', '\n', (byte) 0xFF, '1', '\r', '\n'});

        AppException failure = assertThrows(AppException.class, () -> service.dryRun(file));
        assertTrue(failure.getMessage().contains("CSV UTF-8"));
    }

    @Test
    void refusesMoreThanTenThousandRows() {
        StringBuilder text = new StringBuilder(
                String.join(",", CsvProductImportValidator.HEADERS)).append("\r\n");
        for (int index = 0; index < CsvProductImportValidator.MAX_ROWS + 1; index++) {
            text.append(row("Áo " + index, "Áo thơm", "Đen", "M", "")).append("\r\n");
        }
        MockMultipartFile file = new MockMultipartFile("file", "many.csv", "text/csv",
                text.toString().getBytes(StandardCharsets.UTF_8));

        AppException failure = assertThrows(AppException.class, () -> service.dryRun(file));
        assertTrue(failure.getMessage().contains("10.000"));
    }

    @Test
    void templateUsesTheVietnameseHeaderRowWithBom() {
        CsvProductImportService.CsvTemplate template = service.template();

        assertEquals("mau-nhap-san-pham.csv", template.filename());
        byte[] content = template.content();
        assertEquals((byte) 0xEF, content[0]);
        String text = new String(content, StandardCharsets.UTF_8);
        for (String header : CsvProductImportValidator.HEADERS) {
            assertTrue(text.contains(header), header);
        }
        assertTrue(text.contains("\r\n"));
    }
}
