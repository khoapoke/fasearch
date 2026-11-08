package com.springboot.fasearch.modules.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.mapper.CategoryMapper;
import com.springboot.fasearch.modules.product.mapper.ProductMapper;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.product.service.impl.CategoryServiceImpl;
import com.springboot.fasearch.modules.product.service.impl.ProductServiceImpl;
import com.springboot.fasearch.modules.product.service.impl.ProductVariantServiceImpl;
import com.springboot.fasearch.modules.product.service.interfaces.BarcodeService;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;

/**
 * Xóa mềm sản phẩm / biến thể / danh mục ở tầng service: phải chưa xuất bản, phải qua guard,
 * và ghi lại người xóa từ security context + lý do đã cắt khoảng trắng.
 */
@ExtendWith(MockitoExtension.class)
class SoftDeleteServiceTest {

    @Mock private ProductRepository productRepository;
    @Mock private ProductVariantRepository productVariantRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private BrandRepository brandRepository;
    @Mock private ProductMapper productMapper;
    @Mock private CategoryMapper categoryMapper;
    @Mock private BarcodeService barcodeService;
    @Mock private DeleteGuards deleteGuards;
    @Mock private AccountRepository accountRepository;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private ProductServiceImpl productService() {
        return new ProductServiceImpl(productRepository, productVariantRepository, inventoryRepository,
                categoryRepository, brandRepository, productMapper, deleteGuards,
                new SoftDeleteRecorder(accountRepository));
    }

    private ProductVariantServiceImpl variantService() {
        return new ProductVariantServiceImpl(productRepository, productVariantRepository, productMapper,
                barcodeService, deleteGuards, new SoftDeleteRecorder(accountRepository), inventoryRepository);
    }

    private CategoryServiceImpl categoryService() {
        return new CategoryServiceImpl(categoryRepository, categoryMapper, deleteGuards,
                new SoftDeleteRecorder(accountRepository));
    }

    private static Product product(Long id, PublicationStatus publicationStatus) {
        Product product = Product.builder()
                .id(id)
                .productName("Áo thử xóa")
                .status(ProductStatus.ACTIVE)
                .isDeleted(false)
                .publicationStatus(publicationStatus)
                .variants(new ArrayList<>())
                .build();
        ProductVariant one = ProductVariant.builder().id(100L).product(product).color("Đen").size("L")
                .barcode("SP-100").isDeleted(false).build();
        ProductVariant two = ProductVariant.builder().id(101L).product(product).color("Trắng").size("M")
                .barcode("SP-101").isDeleted(false).build();
        product.getVariants().addAll(List.of(one, two));
        return product;
    }

    @Test
    void unpublishedProductWithNoHistoryIsSoftDeletedWithProvenance() {
        Product product = product(10L, PublicationStatus.UNPUBLISHED);
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        Account actor = Account.builder().id(42L).username("chapter5_admin").build();
        when(accountRepository.findByUsername("chapter5_admin")).thenReturn(Optional.of(actor));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "chapter5_admin", "n/a", com.springboot.fasearch.security.TestAuthorities.forRole("ADMIN")));

        productService().deleteProduct(10L, "  Hết mùa  ");

        assertEquals(true, product.getIsDeleted());
        assertEquals(ProductStatus.DISCONTINUED, product.getStatus());
        assertNotNull(product.getDeletedAt());
        assertEquals(actor, product.getDeletedBy());
        assertEquals("Hết mùa", product.getDeleteReason());
        for (ProductVariant variant : product.getVariants()) {
            assertEquals(true, variant.getIsDeleted());
            assertEquals("Hết mùa", variant.getDeleteReason());
            assertEquals(product.getDeletedAt(), variant.getDeletedAt());
        }
        verify(deleteGuards).assertProductDeletable(10L);
    }

    @Test
    void variantDeletedEarlierKeepsItsOwnTimestampOutsideTheProductBatch() {
        Product product = product(10L, PublicationStatus.UNPUBLISHED);
        ProductVariant earlier = product.getVariants().get(0);
        java.time.LocalDateTime before = java.time.LocalDateTime.now().minusDays(3);
        earlier.setIsDeleted(true);
        earlier.setDeletedAt(before);
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));

        productService().deleteProduct(10L, "Hết mùa");

        assertEquals(before, earlier.getDeletedAt());
        ProductVariant other = product.getVariants().get(1);
        assertEquals(product.getDeletedAt(), other.getDeletedAt());
        org.junit.jupiter.api.Assertions.assertNotEquals(product.getDeletedAt(), earlier.getDeletedAt());
    }

    @Test
    void publishedProductIsRefusedBeforeAnyGuardWithAStaffMessage() {
        Product product = product(10L, PublicationStatus.PUBLISHED);
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));

        AppException error = assertThrows(AppException.class, () -> productService().deleteProduct(10L, null));

        assertEquals(ErrorCode.DELETE_BLOCKED_PUBLISHED, error.getErrorCode());
        assertEquals(409, error.getErrorCode().getHttpStatus().value());
        assertEquals(false, product.getIsDeleted());
        verify(deleteGuards, never()).assertProductDeletable(any());
    }

    @Test
    void guardRefusalLeavesTheProductUntouched() {
        Product product = product(10L, PublicationStatus.UNPUBLISHED);
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        doThrow(new AppException(ErrorCode.DELETE_BLOCKED_BY_HISTORY, "Không thể xóa sản phẩm vì đã có 2 dòng trong đơn hàng."))
                .when(deleteGuards).assertProductDeletable(10L);

        AppException error = assertThrows(AppException.class, () -> productService().deleteProduct(10L, "lý do"));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_HISTORY, error.getErrorCode());
        assertEquals(false, product.getIsDeleted());
        assertEquals(null, product.getDeletedAt());
        verify(productRepository, never()).save(any());
    }

    @Test
    void variantDeleteRunsItsOwnGuardAndRecordsTheActor() {
        ProductVariant variant = ProductVariant.builder().id(101L).color("Đen").size("L").barcode("SP-101")
                .isDeleted(false).build();
        when(productVariantRepository.findById(101L)).thenReturn(Optional.of(variant));
        Account actor = Account.builder().id(42L).username("chapter5_admin").build();
        when(accountRepository.findByUsername("chapter5_admin")).thenReturn(Optional.of(actor));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "chapter5_admin", "n/a", com.springboot.fasearch.security.TestAuthorities.forRole("STAFF")));

        variantService().deleteVariant(101L, "Trùng màu");

        assertEquals(true, variant.getIsDeleted());
        assertEquals(actor, variant.getDeletedBy());
        assertEquals("Trùng màu", variant.getDeleteReason());
        verify(deleteGuards).assertVariantDeletable(101L);
    }

    @Test
    void variantDeleteIsBlockedByItsGuard() {
        ProductVariant variant = ProductVariant.builder().id(101L).color("Đen").size("L").barcode("SP-101")
                .isDeleted(false).build();
        when(productVariantRepository.findById(101L)).thenReturn(Optional.of(variant));
        doThrow(new AppException(ErrorCode.DELETE_BLOCKED_BY_STOCK, "Không thể xóa SKU vì còn tồn kho vật lý hoặc giữ chỗ."))
                .when(deleteGuards).assertVariantDeletable(101L);

        AppException error = assertThrows(AppException.class, () -> variantService().deleteVariant(101L, null));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_STOCK, error.getErrorCode());
        assertEquals(false, variant.getIsDeleted());
    }

    @Test
    void categoryDeleteCountsProductsIncludingSoftDeletedOnes() {
        Category category = Category.builder().id(3L).categoryName("Áo").isDeleted(false).build();
        when(categoryRepository.findById(3L)).thenReturn(Optional.of(category));
        Account actor = Account.builder().id(42L).username("chapter5_admin").build();
        when(accountRepository.findByUsername("chapter5_admin")).thenReturn(Optional.of(actor));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "chapter5_admin", "n/a", com.springboot.fasearch.security.TestAuthorities.forRole("STAFF")));

        categoryService().deleteCategory(3L, "Gộp danh mục");

        assertEquals(true, category.getIsDeleted());
        assertEquals(actor, category.getDeletedBy());
        assertEquals("Gộp danh mục", category.getDeleteReason());
        verify(categoryRepository).save(category);
    }

    @Test
    void categoryDeleteIsBlockedWhileAnyProductReferencesIt() {
        Category category = Category.builder().id(3L).categoryName("Áo").isDeleted(false).build();
        when(categoryRepository.findById(3L)).thenReturn(Optional.of(category));
        doThrow(new AppException(ErrorCode.DELETE_BLOCKED_BY_REFERENCES,
                "Không thể xóa danh mục vì còn 5 sản phẩm (kể cả sản phẩm đã xóa) đang tham chiếu."))
                .when(deleteGuards).assertCategoryDeletable(3L);

        AppException error = assertThrows(AppException.class, () -> categoryService().deleteCategory(3L, null));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_REFERENCES, error.getErrorCode());
        assertEquals(false, category.getIsDeleted());
        verify(categoryRepository, never()).save(eq(category));
    }
}
