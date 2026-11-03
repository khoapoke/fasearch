package com.springboot.fasearch.modules.publish;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.order.repository.OrderDetailRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftUpdateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftVariantReq;
import com.springboot.fasearch.modules.publish.entity.AiSyncStatus;
import com.springboot.fasearch.modules.publish.entity.ProductAiSync;
import com.springboot.fasearch.modules.publish.entity.ProductDraft;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;
import com.springboot.fasearch.modules.publish.repository.ProductAiSyncRepository;
import com.springboot.fasearch.modules.publish.repository.ProductDraftRepository;
import com.springboot.fasearch.modules.publish.repository.ProductDraftVariantRepository;
import com.springboot.fasearch.modules.publish.service.impl.FashionAiPublishClient;
import com.springboot.fasearch.modules.publish.service.impl.PublishServiceImpl;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;

@ExtendWith(MockitoExtension.class)
class PublishServiceTest {

    @Mock private ProductRepository productRepository;
    @Mock private ProductVariantRepository productVariantRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private BrandRepository brandRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private OrderDetailRepository orderDetailRepository;
    @Mock private ProductDraftRepository draftRepository;
    @Mock private ProductDraftVariantRepository draftVariantRepository;
    @Mock private ProductAiSyncRepository aiSyncRepository;
    @Mock private FashionAiPublishClient aiPublishClient;
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;

    private PublishServiceImpl service;
    private Category category;

    @BeforeEach
    void setUp() {
        service = new PublishServiceImpl(productRepository, productVariantRepository, categoryRepository,
                brandRepository, inventoryRepository, orderDetailRepository, draftRepository,
                draftVariantRepository, aiSyncRepository, aiPublishClient, eventPublisher);
        category = Category.builder().id(7L).categoryName("Ao Thun").build();
    }

    private AdminDraftCreateReq newProductRequest() {
        AdminDraftCreateReq req = new AdminDraftCreateReq();
        req.setProductName("Ao Test Publish");
        req.setCategoryId(7L);
        req.setPrice(new BigDecimal("199000"));
        AdminDraftVariantReq v = new AdminDraftVariantReq();
        v.setColor("Den");
        v.setSize("M");
        v.setBarcode("TEST-PUB-001");
        v.setStock(5);
        req.setVariants(List.of(v));
        return req;
    }

    @Test
    void createDraftRejectsDuplicateBarcodeFromAnotherProduct() {
        when(categoryRepository.findById(7L)).thenReturn(Optional.of(category));
        com.springboot.fasearch.modules.product.entity.ProductVariant other =
                com.springboot.fasearch.modules.product.entity.ProductVariant.builder().id(99L).build();
        Product otherProduct = Product.builder().id(55L).productName("Other").build();
        other.setProduct(otherProduct);
        when(productVariantRepository.findByBarcode("TEST-PUB-001")).thenReturn(Optional.of(other));
        AppException error = assertThrows(AppException.class, () -> service.createDraft(newProductRequest()));
        assertEquals(com.springboot.fasearch.exception.ErrorCode.DATA_CONFLICT, error.getErrorCode());
        verify(draftRepository, never()).save(any());
    }

    @Test
    void updateDraftRejectsStaleVersionWithoutMutation() {
        ProductDraft draft = ProductDraft.builder().id(1L).version(3L).draftState("DRAFT").build();
        when(draftRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(draft));
        AdminDraftUpdateReq req = new AdminDraftUpdateReq();
        req.setExpectedVersion(2L);
        req.setProductName("Changed");
        AppException error = assertThrows(AppException.class, () -> service.updateDraft(1L, req));
        assertEquals(com.springboot.fasearch.exception.ErrorCode.DATA_CONFLICT, error.getErrorCode());
        verify(draftRepository, never()).save(any());
    }

    @Test
    void deleteDraftNeverTouchesPublishedProduct() {
        Product published = Product.builder().id(10L).build();
        ProductDraft draft = ProductDraft.builder().id(2L).version(1L).draftState("DRAFT").product(published).build();
        when(draftRepository.findById(2L)).thenReturn(Optional.of(draft));
        service.deleteDraft(2L);
        verify(productRepository, never()).save(any());
        verify(productRepository, never()).deleteById(any());
        verify(draftRepository).delete(org.mockito.ArgumentMatchers.any(ProductDraft.class));
    }

    @Test
    void retryKeepsReadyWhenVersionMatches() {
        Product product = Product.builder().id(11L).build();
        product.setPublicationStatus(PublicationStatus.PUBLISHED);
        product.setPublicationVersion(4L);
        ProductAiSync sync = ProductAiSync.builder().productId(11L)
                .version(4L).status(AiSyncStatus.READY).attempts(1).build();
        when(aiSyncRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(sync));
        when(productRepository.findById(11L)).thenReturn(Optional.of(product));
        var res = service.retryAiSync(11L);
        assertEquals("READY", res.getStatus());
        assertEquals(4L, res.getVersion());
        verify(aiPublishClient, never()).upsertProduct(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void lateEventSupersededByNewerVersion() {
        Product product = Product.builder().id(12L).build();
        product.setPublicationStatus(PublicationStatus.PUBLISHED);
        product.setPublicationVersion(6L);
        ProductAiSync sync = ProductAiSync.builder().productId(12L)
                .version(5L).status(AiSyncStatus.PENDING).attempts(0).build();
        when(aiSyncRepository.findByIdForUpdate(12L)).thenReturn(Optional.of(sync));
        when(productRepository.findById(12L)).thenReturn(Optional.of(product));
        service.reconcilePending(12L);
        ArgumentCaptor<ProductAiSync> captor = ArgumentCaptor.forClass(ProductAiSync.class);
        verify(aiSyncRepository).save(captor.capture());
        assertEquals(AiSyncStatus.FAILED, captor.getValue().getStatus());
        verify(aiPublishClient, never()).upsertProduct(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void editDraftBindsRealProductAndSeedsPublishedSnapshot() {
        Product published = Product.builder().id(30L).productName("Ao Cu").category(category)
                .price(new BigDecimal("250000")).imageUrl("/api/v1/products/images/cu.jpg").build();
        when(productRepository.findById(30L)).thenReturn(Optional.of(published));
        when(categoryRepository.findById(7L)).thenReturn(Optional.of(category));
        when(draftRepository.findByProduct_IdAndDraftState(30L, "DRAFT")).thenReturn(Optional.empty());
        com.springboot.fasearch.modules.product.entity.ProductVariant sku =
                com.springboot.fasearch.modules.product.entity.ProductVariant.builder()
                        .id(301L).color("Xanh").size("L").barcode("CU-001")
                        .additionalPrice(BigDecimal.ZERO).build();
        when(productVariantRepository.findByProductId(30L)).thenReturn(List.of(sku));
        com.springboot.fasearch.modules.inventory.entity.Inventory stock =
                com.springboot.fasearch.modules.inventory.entity.Inventory.builder().availableStock(9).build();
        when(inventoryRepository.findByVariantId(301L)).thenReturn(Optional.of(stock));
        when(draftRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(draftVariantRepository.findByDraft_Id(any())).thenReturn(List.of());

        AdminDraftCreateReq req = new AdminDraftCreateReq();
        req.setProductId(30L);
        var res = service.createDraft(req);

        assertEquals(30L, res.getProductId());
        assertEquals("Ao Cu", res.getProductName());
        assertEquals(new BigDecimal("250000"), res.getPrice());
        org.mockito.ArgumentCaptor<com.springboot.fasearch.modules.publish.entity.ProductDraftVariant> captor =
                org.mockito.ArgumentCaptor.forClass(com.springboot.fasearch.modules.publish.entity.ProductDraftVariant.class);
        verify(draftVariantRepository).save(captor.capture());
        assertEquals("CU-001", captor.getValue().getBarcode());
        assertEquals(9, captor.getValue().getStock());
        verify(productRepository, never()).save(any());
    }

    @Test
    void editDraftWithUnknownProductIdIsNotFound() {
        when(productRepository.findById(404L)).thenReturn(Optional.empty());
        AdminDraftCreateReq req = new AdminDraftCreateReq();
        req.setProductId(404L);
        AppException error = assertThrows(AppException.class, () -> service.createDraft(req));
        assertEquals(com.springboot.fasearch.exception.ErrorCode.PRODUCT_NOT_FOUND, error.getErrorCode());
        verify(draftRepository, never()).save(any());
    }

    @Test
    void editDraftOnSoftDeletedProductIsNotFound() {
        Product deleted = Product.builder().id(31L).productName("Da xoa").isDeleted(true).build();
        when(productRepository.findById(31L)).thenReturn(Optional.of(deleted));
        AdminDraftCreateReq req = new AdminDraftCreateReq();
        req.setProductId(31L);
        AppException error = assertThrows(AppException.class, () -> service.createDraft(req));
        assertEquals(com.springboot.fasearch.exception.ErrorCode.PRODUCT_NOT_FOUND, error.getErrorCode());
    }

    @Test
    void publishResponseExposesFeAliases() {
        Product product = Product.builder().id(21L).productName("Alias").isDeleted(false).build();
        product.setPublicationStatus(PublicationStatus.PUBLISHED);
        product.setPublicationVersion(3L);
        ProductDraft draft = ProductDraft.builder().id(7L).version(2L).draftState("DRAFT").product(product)
                .productName("Alias").category(category).price(new BigDecimal("100000"))
                .imageUrl("/api/v1/products/images/alias.jpg").build();
        when(draftRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(draft));
        com.springboot.fasearch.modules.publish.entity.ProductDraftVariant dv =
                com.springboot.fasearch.modules.publish.entity.ProductDraftVariant.builder()
                        .id(70L).draft(draft).color("Den").size("M").barcode("ALIAS-1")
                        .additionalPrice(BigDecimal.ZERO).stock(4).build();
        when(draftVariantRepository.findByDraft_Id(7L)).thenReturn(List.of(dv));
        when(productRepository.findByIdForUpdate(21L)).thenReturn(Optional.of(product));
        when(productRepository.findById(21L)).thenReturn(Optional.of(product));
        when(aiSyncRepository.findById(21L)).thenReturn(Optional.empty());
        when(aiSyncRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(inventoryRepository.findByVariantId(any())).thenReturn(Optional.empty());
        when(productVariantRepository.findById(any())).thenAnswer(i -> {
            com.springboot.fasearch.modules.product.entity.ProductVariant v =
                    com.springboot.fasearch.modules.product.entity.ProductVariant.builder()
                            .id((Long) i.getArgument(0)).isDeleted(false).build();
            return Optional.of(v);
        });
        when(inventoryRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(productVariantRepository.save(any())).thenAnswer(i -> {
            com.springboot.fasearch.modules.product.entity.ProductVariant v = i.getArgument(0);
            if (v.getId() == null) v.setId(701L);
            return v;
        });
        when(productRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(draftRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        var res = service.publishDraft(7L, 2L);
        assertEquals("PUBLISHED", res.getStatus());
        assertEquals("PUBLISHED", res.getPublicationStatus());
        assertEquals("PENDING", res.getAiSync());
        assertEquals("PENDING", res.getAiSyncStatus());
    }

    @Test
    void publishRequiresImageAndVariant() {
        ProductDraft draft = ProductDraft.builder().id(3L).version(1L).draftState("DRAFT")
                .productName("Ao Thieu Anh").category(category).price(new BigDecimal("100000")).build();
        when(draftRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(draft));
        when(draftVariantRepository.findByDraft_Id(3L)).thenReturn(List.of());
        AppException error = assertThrows(AppException.class, () -> service.publishDraft(3L, 1L));
        assertEquals(com.springboot.fasearch.exception.ErrorCode.INVALID_REQUEST, error.getErrorCode());
        verify(productRepository, never()).save(any());
    }
}
