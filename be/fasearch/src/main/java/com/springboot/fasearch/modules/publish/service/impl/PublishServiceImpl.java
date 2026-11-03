package com.springboot.fasearch.modules.publish.service.impl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.order.repository.OrderDetailRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftUpdateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftVariantReq;
import com.springboot.fasearch.modules.publish.dto.response.AdminDraftRes;
import com.springboot.fasearch.modules.publish.dto.response.AdminDraftVariantRes;
import com.springboot.fasearch.modules.publish.dto.response.AiSyncRes;
import com.springboot.fasearch.modules.publish.dto.response.PublishRes;
import com.springboot.fasearch.modules.publish.entity.AiSyncStatus;
import com.springboot.fasearch.modules.publish.entity.ProductAiSync;
import com.springboot.fasearch.modules.publish.entity.ProductDraft;
import com.springboot.fasearch.modules.publish.entity.ProductDraftVariant;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;
import com.springboot.fasearch.modules.publish.repository.ProductAiSyncRepository;
import com.springboot.fasearch.modules.publish.repository.ProductDraftRepository;
import com.springboot.fasearch.modules.publish.repository.ProductDraftVariantRepository;
import com.springboot.fasearch.modules.publish.service.interfaces.PublishService;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class PublishServiceImpl implements PublishService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final ProductDraftRepository draftRepository;
    private final ProductDraftVariantRepository draftVariantRepository;
    private final ProductAiSyncRepository aiSyncRepository;
    private final FashionAiPublishClient aiPublishClient;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    @Value("${product.image.upload-dir:uploads/products}")
    private String uploadDir;

    @Override
    @Transactional
    public AdminDraftRes createDraft(AdminDraftCreateReq request) {
        Product published = null;
        if (request.getProductId() != null) {
            published = productRepository.findById(request.getProductId())
                    .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
            if (Boolean.TRUE.equals(published.getIsDeleted())) {
                throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
            }
            if (draftRepository.findByProduct_IdAndDraftState(published.getId(), "DRAFT").isPresent()) {
                throw new AppException(ErrorCode.DATA_CONFLICT, "An open draft already exists for this product");
            }
            seedFromPublished(request, published);
        } else {
            validateNewDraft(request);
        }
        validateDraftVariants(request.getVariants(),
                published == null ? null : published.getId());
        ProductDraft draft = newDraft(request, published);
        draft.setVersion(1L);
        draft.setDraftState("DRAFT");
        draft = draftRepository.save(draft);
        saveDraftVariants(draft, request.getVariants());
        return response(draft);
    }

    @Override
    @Transactional
    public AdminDraftRes updateDraft(Long draftId, AdminDraftUpdateReq request) {
        ProductDraft draft = draftRepository.findByIdForUpdate(draftId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft not found"));
        requireOpen(draft);
        if (!draft.getVersion().equals(request.getExpectedVersion())) {
            throw new AppException(ErrorCode.DATA_CONFLICT, "Draft changed by another session; reload and retry");
        }
        applyScalars(draft, request.getProductName(), request.getCategoryId(), request.getBrandId(),
                request.getModelCode(), request.getMaterial(), request.getStyle(), request.getDescription(),
                request.getPrice(), request.getImageUrl());
        if (request.getVariants() != null) {
            validateDraftVariants(request.getVariants(),
                    draft.getProduct() == null ? null : draft.getProduct().getId());
            draftVariantRepository.deleteByDraft_Id(draft.getId());
            saveDraftVariants(draft, request.getVariants());
        }
        draft.setVersion(draft.getVersion() + 1);
        return response(draftRepository.save(draft));
    }

    @Override
    @Transactional(readOnly = true)
    public AdminDraftRes getDraft(Long draftId) {
        return response(draftRepository.findById(draftId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft not found")));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminDraftRes> listDrafts(Pageable pageable, Long productId) {
        Page<ProductDraft> page = productId == null
                ? draftRepository.findByDraftState("DRAFT", pageable)
                : draftRepository.findByProduct_IdOrderByUpdatedAtDesc(productId, pageable);
        return PageResponse.from(page.map(this::response));
    }

    @Override
    @Transactional
    public void deleteDraft(Long draftId) {
        ProductDraft draft = draftRepository.findById(draftId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft not found"));
        requireOpen(draft);
        draftVariantRepository.deleteByDraft_Id(draft.getId());
        draftRepository.delete(draft);
    }

    @Override
    @Transactional
    public String uploadDraftImage(Long draftId, MultipartFile file) {
        ProductDraft draft = draftRepository.findByIdForUpdate(draftId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft not found"));
        requireOpen(draft);
        java.nio.file.Path root = DraftImageFiles.uploadRoot(uploadDir);
        String fileName = DraftImageFiles.store(file, root);
        java.nio.file.Path target = root.resolve(fileName);
        try {
            draft.setImageUrl("/api/v1/admin/products/drafts/" + draft.getId() + "/images/" + fileName);
            draft.setVersion(draft.getVersion() + 1);
            draftRepository.save(draft);
        } catch (RuntimeException e) {
            try {
                java.nio.file.Files.deleteIfExists(target);
            } catch (java.io.IOException ignored) {
            }
            throw e;
        }
        return draft.getImageUrl();
    }

    @Override
    @Transactional
    public PublishRes publishDraft(Long draftId, Long expectedVersion) {
        ProductDraft draft = draftRepository.findByIdForUpdate(draftId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft not found"));
        requireOpen(draft);
        if (!draft.getVersion().equals(expectedVersion)) {
            throw new AppException(ErrorCode.DATA_CONFLICT, "Draft changed by another session; reload and retry");
        }
        validateDraftComplete(draft);
        final Product product;
        if (draft.getProduct() == null) {
            Product created = new Product();
            created.setProductName(draft.getProductName());
            created.setCategory(draft.getCategory());
            created.setBrand(draft.getBrand());
            created.setModelCode(draft.getModelCode());
            created.setMaterial(draft.getMaterial());
            created.setStyle(draft.getStyle());
            created.setDescription(draft.getDescription());
            created.setPrice(draft.getPrice());
            created.setImageUrl(publishImage(draft));
            created.setStatus(draft.getStatus() == null ? ProductStatus.ACTIVE : draft.getStatus());
            created.setIsDeleted(false);
            created.setPublicationStatus(PublicationStatus.PUBLISHED);
            created.setPublicationVersion(1L);
            created = productRepository.save(created);
            for (ProductDraftVariant dv : draftVariantRepository.findByDraft_Id(draft.getId())) {
                ProductVariant variant = ProductVariant.builder()
                        .product(created)
                        .color(dv.getColor())
                        .size(dv.getSize())
                        .barcode(dv.getBarcode())
                        .additionalPrice(dv.getAdditionalPrice() == null ? BigDecimal.ZERO : dv.getAdditionalPrice())
                        .isDeleted(false)
                        .build();
                variant = productVariantRepository.save(variant);
                createInitialStock(variant.getId(), dv.getStock());
            }
            product = created;
        } else {
            Product target = productRepository.findByIdForUpdate(draft.getProduct().getId())
                    .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
            mergeScalars(target, draft);
            if (draft.getImageUrl() != null && draft.getImageUrl().contains("/drafts/")) {
                target.setImageUrl(publishImage(draft));
            }
            mergeVariants(target, draft);
            target.setPublicationStatus(PublicationStatus.PUBLISHED);
            target.setPublicationVersion(target.getPublicationVersion() == null ? 1L : target.getPublicationVersion() + 1);
            product = productRepository.save(target);
        }
        draft.setDraftState("PUBLISHED");
        draft.setVersion(draft.getVersion() + 1);
        draftRepository.save(draft);
        enqueueAiSync(product.getId(), product.getPublicationVersion());
        eventPublisher.publishEvent(new com.springboot.fasearch.modules.publish.ProductPublishedEvent(product.getId()));
        String publicationStatus = product.getPublicationStatus().name();
        String aiSyncStatus = AiSyncStatus.PENDING.name();
        return PublishRes.builder().productId(product.getId()).version(product.getPublicationVersion())
                .publicationStatus(publicationStatus).aiSyncStatus(aiSyncStatus)
                .status(publicationStatus).aiSync(aiSyncStatus).build();
    }

    @Override
    @Transactional
    public PublishRes unpublishProduct(Long productId, String reason) {
        Product product = productRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        if (product.getPublicationStatus() != PublicationStatus.PUBLISHED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Only a published product can be unpublished");
        }
        product.setPublicationStatus(PublicationStatus.UNPUBLISHED);
        product.setPublicationVersion(product.getPublicationVersion() + 1);
        productRepository.save(product);
        enqueueAiSync(product.getId(), product.getPublicationVersion());
        log.info("Unpublished product [{}]: {}", productId, reason);
        eventPublisher.publishEvent(new com.springboot.fasearch.modules.publish.ProductPublishedEvent(product.getId()));
        return PublishRes.builder().productId(product.getId()).version(product.getPublicationVersion())
                .publicationStatus(PublicationStatus.UNPUBLISHED.name()).aiSyncStatus(AiSyncStatus.PENDING.name())
                .status(PublicationStatus.UNPUBLISHED.name()).aiSync(AiSyncStatus.PENDING.name()).build();
    }

    @Override
    @Transactional(readOnly = true)
    public AiSyncRes aiSyncState(Long productId) {
        ProductAiSync sync = aiSyncRepository.findById(productId).orElse(null);
        if (sync == null) {
            return AiSyncRes.builder().productId(productId).version(null)
                    .status("NEVER_QUEUED").attempts(0).updatedAt(null).lastError(null).build();
        }
        return aiSyncResponse(sync);
    }

    @Override
    @Transactional
    public AiSyncRes retryAiSync(Long productId) {
        ProductAiSync sync = aiSyncRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "No AI sync record for product"));
        if (sync.getStatus() == AiSyncStatus.READY) {
            Product product = productRepository.findById(productId).orElse(null);
            if (product != null && sync.getVersion().equals(product.getPublicationVersion())) {
                return aiSyncResponse(sync);
            }
        }
        sync.setStatus(AiSyncStatus.PENDING);
        sync.setLastError(null);
        aiSyncRepository.save(sync);
        reconcilePending(productId);
        return aiSyncState(productId);
    }

    @Override
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void reconcilePending(Long productId) {
        ProductAiSync sync = aiSyncRepository.findByIdForUpdate(productId).orElse(null);
        if (sync == null || sync.getStatus() == AiSyncStatus.READY) {
            return;
        }
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null || Boolean.TRUE.equals(product.getIsDeleted())) {
            sync.setStatus(AiSyncStatus.FAILED);
            sync.setLastError("Product missing or deleted");
            aiSyncRepository.save(sync);
            return;
        }
        if (!sync.getVersion().equals(product.getPublicationVersion())) {
            sync.setStatus(AiSyncStatus.FAILED);
            sync.setLastError("Superseded by newer published version " + product.getPublicationVersion());
            aiSyncRepository.save(sync);
            return;
        }
        sync.setStatus(AiSyncStatus.RUNNING);
        sync.setAttempts(sync.getAttempts() + 1);
        aiSyncRepository.saveAndFlush(sync);
        try {
            if (product.getPublicationStatus() != PublicationStatus.PUBLISHED) {
                aiPublishClient.deleteProduct(product.getId());
            } else {
                byte[] imageBytes = readProductImage(product.getImageUrl());
                aiPublishClient.upsertProduct(product.getId(), product.getProductName(),
                        product.getDescription(),
                        product.getBrand() == null ? null : product.getBrand().getSlug(),
                        product.getModelCode(), imageBytes, imageFileName(product.getImageUrl()));
            }
            sync.setStatus(AiSyncStatus.READY);
            sync.setLastError(null);
        } catch (AppException e) {
            sync.setStatus(AiSyncStatus.FAILED);
            sync.setLastError(e.getMessage());
        } catch (RuntimeException e) {
            sync.setStatus(AiSyncStatus.FAILED);
            sync.setLastError("AI sync failed: " + e.getClass().getSimpleName());
        }
        aiSyncRepository.save(sync);
    }

    @Override
    @Transactional
    public void markInterruptedRunsPending() {
        // Boot recovery lives in AiSyncBootRecovery; kept for explicit repair.
    }

    @Override
    @Transactional
    public AdminDraftRes importFromUrl(String url) {
        UrlImport.Parsed parsed = UrlImport.fetchAndParse(url);
        AdminDraftCreateReq mapped = UrlImport.mapToDraft(parsed.product(), categoryRepository);
        mapped.setSourceUrl(url);
        mapped.setSourceHash(parsed.bodySha256());
        mapped.setSourceKind(parsed.kind());
        if (mapped.getCategoryId() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Cannot map feed category; create the category first or enter the draft manually");
        }
        return createDraft(mapped);
    }

    private void enqueueAiSync(Long productId, Long version) {
        ProductAiSync sync = aiSyncRepository.findById(productId).orElse(null);
        if (sync == null) {
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
            sync = ProductAiSync.builder().productId(productId).build();
        }
        sync.setVersion(version);
        sync.setStatus(AiSyncStatus.PENDING);
        sync.setLastError(null);
        aiSyncRepository.save(sync);
    }

    private void requireOpen(ProductDraft draft) {
        if (!"DRAFT".equals(draft.getDraftState())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Draft is closed");
        }
    }

    /** Edit drafts start from the current published snapshot; explicit body values win. */
    private void seedFromPublished(AdminDraftCreateReq request, Product published) {
        if (request.getProductName() == null) {
            request.setProductName(published.getProductName());
        }
        if (request.getCategoryId() == null && published.getCategory() != null) {
            request.setCategoryId(published.getCategory().getId());
        }
        if (request.getBrandId() == null && published.getBrand() != null) {
            request.setBrandId(published.getBrand().getId());
        }
        if (request.getModelCode() == null) {
            request.setModelCode(published.getModelCode());
        }
        if (request.getMaterial() == null) {
            request.setMaterial(published.getMaterial());
        }
        if (request.getStyle() == null) {
            request.setStyle(published.getStyle());
        }
        if (request.getDescription() == null) {
            request.setDescription(published.getDescription());
        }
        if (request.getPrice() == null) {
            request.setPrice(published.getPrice());
        }
        if (request.getImageUrl() == null) {
            request.setImageUrl(published.getImageUrl());
        }
        if (request.getVariants() == null || request.getVariants().isEmpty()) {
            List<AdminDraftVariantReq> snapshot = new ArrayList<>();
            for (ProductVariant variant : productVariantRepository.findByProductId(published.getId())) {
                AdminDraftVariantReq copy = new AdminDraftVariantReq();
                copy.setColor(variant.getColor());
                copy.setSize(variant.getSize());
                copy.setBarcode(variant.getBarcode());
                copy.setAdditionalPrice(variant.getAdditionalPrice());
                inventoryRepository.findByVariantId(variant.getId())
                        .ifPresent(inv -> copy.setStock(inv.getAvailableStock()));
                snapshot.add(copy);
            }
            request.setVariants(snapshot);
        }
        validateNewDraft(request);
    }

    private ProductDraft newDraft(AdminDraftCreateReq request, Product published) {
        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
        }
        Brand brand = null;
        if (request.getBrandId() != null) {
            brand = brandRepository.findById(request.getBrandId()).orElse(null);
            if (brand == null) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand not found");
            }
        }
        if (request.getPrice() != null && request.getPrice().signum() < 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Price must be non-negative");
        }
        if (request.getSourceHash() != null && !request.getSourceHash().matches("[0-9a-fA-F]{64}")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "sourceHash must be a 64-hex digest");
        }
        ProductDraft draft = ProductDraft.builder()
                .product(published)
                .productName(request.getProductName())
                .category(category)
                .brand(brand)
                .modelCode(request.getModelCode())
                .material(request.getMaterial())
                .style(request.getStyle())
                .description(request.getDescription())
                .price(request.getPrice())
                .imageUrl(request.getImageUrl())
                .status(ProductStatus.ACTIVE)
                .sourceUrl(request.getSourceUrl())
                .sourceHash(request.getSourceHash())
                .sourceKind(request.getSourceKind())
                .build();
        if (published != null) {
            if (request.getProductName() == null) draft.setProductName(published.getProductName());
            if (request.getCategoryId() == null) draft.setCategory(published.getCategory());
            if (request.getBrandId() == null) draft.setBrand(published.getBrand());
            if (request.getModelCode() == null) draft.setModelCode(published.getModelCode());
            if (request.getMaterial() == null) draft.setMaterial(published.getMaterial());
            if (request.getStyle() == null) draft.setStyle(published.getStyle());
            if (request.getDescription() == null) draft.setDescription(published.getDescription());
            if (request.getPrice() == null) draft.setPrice(published.getPrice());
            if (request.getImageUrl() == null) draft.setImageUrl(published.getImageUrl());
        }
        return draft;
    }

    private void applyScalars(ProductDraft draft, String productName, Long categoryId, Long brandId,
            String modelCode, String material, String style, String description,
            BigDecimal price, String imageUrl) {
        if (productName != null) {
            if (productName.isBlank() || productName.length() > 255) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Product name is invalid");
            }
            draft.setProductName(productName.strip());
        }
        if (categoryId != null) {
            draft.setCategory(categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND)));
        }
        if (brandId != null) {
            Brand foundBrand = brandRepository.findById(brandId).orElse(null);
            if (foundBrand == null) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand not found");
            }
            draft.setBrand(foundBrand);
        }
        if (modelCode != null) {
            if (modelCode.length() > 100) throw new AppException(ErrorCode.INVALID_REQUEST, "Model code too long");
            draft.setModelCode(modelCode);
        }
        if (material != null) {
            if (material.length() > 100) throw new AppException(ErrorCode.INVALID_REQUEST, "Material too long");
            draft.setMaterial(material);
        }
        if (style != null) {
            if (style.length() > 100) throw new AppException(ErrorCode.INVALID_REQUEST, "Style too long");
            draft.setStyle(style);
        }
        if (description != null) draft.setDescription(description);
        if (price != null) {
            if (price.signum() < 0) throw new AppException(ErrorCode.INVALID_REQUEST, "Price must be non-negative");
            draft.setPrice(price);
        }
        if (imageUrl != null) draft.setImageUrl(imageUrl);
    }

    private void validateNewDraft(AdminDraftCreateReq request) {
        if (request.getProductName() == null || request.getProductName().isBlank()
                || request.getProductName().length() > 255) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Product name is required (max 255)");
        }
        if (request.getCategoryId() == null
                || !categoryRepository.findById(request.getCategoryId()).isPresent()) {
            throw new AppException(ErrorCode.CATEGORY_NOT_FOUND);
        }
        if (request.getPrice() == null || request.getPrice().signum() < 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Price is required and must be non-negative");
        }
        if (request.getBrandId() != null && !brandRepository.findById(request.getBrandId()).isPresent()) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand not found");
        }
    }

    private void validateDraftVariants(List<AdminDraftVariantReq> variants, Long publishedProductId) {
        if (variants == null) {
            return;
        }
        Set<String> seenCombo = new HashSet<>();
        Set<String> seenBarcode = new HashSet<>();
        for (AdminDraftVariantReq v : variants) {
            String color = blankToNull(v.getColor());
            String size = blankToNull(v.getSize());
            String barcode = blankToNull(v.getBarcode());
            if (color == null && size == null && barcode == null) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Variant needs color, size or barcode");
            }
            String comboKey = norm(color) + "|" + norm(size);
            if (!"|".equals(comboKey) && !seenCombo.add(comboKey)) {
                throw new AppException(ErrorCode.DATA_CONFLICT, "Duplicate color/size combination in draft");
            }
            String normalizedBarcode = barcode == null ? null : barcode.toUpperCase(Locale.ROOT);
            if (normalizedBarcode != null && !seenBarcode.add(normalizedBarcode)) {
                throw new AppException(ErrorCode.DATA_CONFLICT, "Duplicate barcode in draft");
            }
            if (normalizedBarcode != null) {
                final String code = normalizedBarcode;
                productVariantRepository.findByBarcode(code).ifPresent(existing -> {
                    if (publishedProductId == null || existing.getProduct() == null
                            || !publishedProductId.equals(existing.getProduct().getId())) {
                        throw new AppException(ErrorCode.DATA_CONFLICT, "Barcode already exists");
                    }
                });
            }
            if (v.getAdditionalPrice() != null && v.getAdditionalPrice().signum() < 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Additional price must be non-negative");
            }
            if (v.getStock() != null && v.getStock() < 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Stock must be non-negative");
            }
        }
    }

    private void saveDraftVariants(ProductDraft draft, List<AdminDraftVariantReq> variants) {
        if (variants == null) {
            return;
        }
        for (AdminDraftVariantReq v : variants) {
            draftVariantRepository.save(ProductDraftVariant.builder()
                    .draft(draft)
                    .color(blankToNull(v.getColor()))
                    .size(blankToNull(v.getSize()))
                    .barcode(v.getBarcode() == null ? null : v.getBarcode().strip().toUpperCase(Locale.ROOT))
                    .additionalPrice(v.getAdditionalPrice() == null ? BigDecimal.ZERO : v.getAdditionalPrice())
                    .stock(v.getStock())
                    .build());
        }
    }

    private void validateDraftComplete(ProductDraft draft) {
        if (draft.getProductName() == null || draft.getProductName().isBlank()
                || draft.getCategory() == null || draft.getPrice() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Draft is incomplete: name, category and price are required");
        }
        if (draftVariantRepository.findByDraft_Id(draft.getId()).isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Draft needs at least one SKU");
        }
        if (draft.getImageUrl() == null || draft.getImageUrl().isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Draft needs a primary image before publish");
        }
    }

    private void mergeScalars(Product product, ProductDraft draft) {
        product.setProductName(draft.getProductName());
        product.setCategory(draft.getCategory());
        product.setBrand(draft.getBrand());
        product.setModelCode(draft.getModelCode());
        product.setMaterial(draft.getMaterial());
        product.setStyle(draft.getStyle());
        product.setDescription(draft.getDescription());
        product.setPrice(draft.getPrice());
        product.setImageUrl(draft.getImageUrl());
        if (draft.getStatus() != null) {
            product.setStatus(draft.getStatus());
        }
    }

    private void mergeVariants(Product product, ProductDraft draft) {
        List<ProductDraftVariant> wanted = draftVariantRepository.findByDraft_Id(draft.getId());
        Map<String, ProductVariant> byBarcode = new HashMap<>();
        for (ProductVariant v : product.getVariants()) {
            if (v.getBarcode() != null) {
                byBarcode.put(v.getBarcode().strip().toUpperCase(Locale.ROOT), v);
            }
        }
        Set<Long> keepIds = new HashSet<>();
        for (ProductDraftVariant dv : wanted) {
            ProductVariant target = dv.getBarcode() == null ? null
                    : byBarcode.get(dv.getBarcode().strip().toUpperCase(Locale.ROOT));
            if (target == null) {
                target = ProductVariant.builder().product(product).isDeleted(false).build();
            }
            target.setColor(dv.getColor());
            target.setSize(dv.getSize());
            target.setBarcode(dv.getBarcode());
            target.setAdditionalPrice(dv.getAdditionalPrice() == null ? BigDecimal.ZERO : dv.getAdditionalPrice());
            boolean isNew = target.getId() == null;
            target = productVariantRepository.save(target);
            keepIds.add(target.getId());
            if (isNew) {
                createInitialStock(target.getId(), dv.getStock());
            }
        }
        for (ProductVariant existing : new ArrayList<>(product.getVariants())) {
            if (keepIds.contains(existing.getId())) {
                continue;
            }
            if (orderDetailRepository.existsById_SkuId(existing.getId())) {
                throw new AppException(ErrorCode.DATA_CONFLICT,
                        "Cannot remove SKU referenced by orders: " + existing.getBarcode());
            }
            inventoryRepository.findByVariantId(existing.getId()).ifPresent(inventoryRepository::delete);
            product.getVariants().remove(existing);
            productVariantRepository.delete(existing);
        }
    }

    private void createInitialStock(Long skuId, Integer stock) {
        int quantity = stock == null ? 0 : stock;
        if (inventoryRepository.findByVariantId(skuId).isPresent()) {
            return;
        }
        ProductVariant variant = productVariantRepository.findById(skuId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        inventoryRepository.save(Inventory.builder()
                .variant(variant)
                .physicalStock(quantity)
                .reservedStock(0)
                .availableStock(quantity)
                .minThreshold(2)
                .isDeleted(false)
                .build());
    }

    private java.nio.file.Path uploadPath() {
        return DraftImageFiles.uploadRoot(uploadDir);
    }

    /** Promote the staged draft image into the public product media directory. */
    private String publishImage(ProductDraft draft) {
        String draftUrl = draft.getImageUrl();
        if (draftUrl == null || draftUrl.isBlank() || !draftUrl.contains("/drafts/")) {
            return draftUrl;
        }
        String fileName = draftUrl.substring(draftUrl.lastIndexOf('/') + 1);
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid draft image reference");
        }
        java.nio.file.Path source = uploadPath().resolve(fileName).normalize();
        java.nio.file.Path publicRoot = java.nio.file.Paths.get(uploadDir).toAbsolutePath().normalize();
        String ext = fileName.substring(fileName.lastIndexOf('.'));
        String published = java.util.UUID.randomUUID() + ext;
        java.nio.file.Path target = publicRoot.resolve(published).normalize();
        if (!source.startsWith(uploadPath()) || !target.startsWith(publicRoot) || !java.nio.file.Files.exists(source)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Draft image missing; upload the image again");
        }
        try {
            java.nio.file.Files.createDirectories(publicRoot);
            java.nio.file.Files.copy(source, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (java.io.IOException e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
        return "/api/v1/products/images/" + published;
    }

    /** Draft image bytes for the ADMIN-only preview endpoint. */
    public byte[] readDraftImage(Long draftId, String fileName) {
        ProductDraft draft = draftRepository.findById(draftId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft not found"));
        if (fileName == null || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")
                || draft.getImageUrl() == null || !draft.getImageUrl().endsWith("/" + fileName)) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft image not found");
        }
        java.nio.file.Path file = uploadPath().resolve(fileName).normalize();
        if (!file.startsWith(uploadPath()) || !java.nio.file.Files.exists(file)) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft image not found");
        }
        try {
            return java.nio.file.Files.readAllBytes(file);
        } catch (java.io.IOException e) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Draft image not found");
        }
    }

    private byte[] readProductImage(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return null;
        }
        String fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            return null;
        }
        java.nio.file.Path root = java.nio.file.Paths.get(uploadDir).toAbsolutePath().normalize();
        java.nio.file.Path file = root.resolve(fileName).normalize();
        if (!file.startsWith(root) || !java.nio.file.Files.exists(file)) {
            return null;
        }
        try {
            return java.nio.file.Files.readAllBytes(file);
        } catch (java.io.IOException e) {
            return null;
        }
    }

    private String imageFileName(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return "product.jpg";
        }
        return imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
    }

    private AdminDraftRes response(ProductDraft draft) {
        List<AdminDraftVariantRes> variants = draftVariantRepository.findByDraft_Id(draft.getId()).stream()
                .map(v -> AdminDraftVariantRes.builder().color(v.getColor()).size(v.getSize())
                        .barcode(v.getBarcode()).additionalPrice(v.getAdditionalPrice()).stock(v.getStock()).build())
                .toList();
        return AdminDraftRes.builder()
                .draftId(draft.getId())
                .productId(draft.getProduct() == null ? null : draft.getProduct().getId())
                .version(draft.getVersion())
                .draftState(draft.getDraftState())
                .productName(draft.getProductName())
                .categoryId(draft.getCategory() == null ? null : draft.getCategory().getId())
                .categoryName(draft.getCategory() == null ? null : draft.getCategory().getCategoryName())
                .brandId(draft.getBrand() == null ? null : draft.getBrand().getId())
                .brandName(draft.getBrand() == null ? null : draft.getBrand().getName())
                .brandSlug(draft.getBrand() == null ? null : draft.getBrand().getSlug())
                .modelCode(draft.getModelCode())
                .material(draft.getMaterial())
                .style(draft.getStyle())
                .description(draft.getDescription())
                .price(draft.getPrice())
                .imageUrl(draft.getImageUrl())
                .status(draft.getStatus())
                .variants(variants)
                .sourceUrl(draft.getSourceUrl())
                .sourceHash(draft.getSourceHash())
                .sourceKind(draft.getSourceKind())
                .updatedAt(draft.getUpdatedAt())
                .build();
    }

    private AiSyncRes aiSyncResponse(ProductAiSync sync) {
        return AiSyncRes.builder().productId(sync.getProductId()).version(sync.getVersion())
                .status(sync.getStatus().name()).attempts(sync.getAttempts())
                .updatedAt(sync.getUpdatedAt()).lastError(sync.getLastError()).build();
    }

    private static String norm(String value) {
        return value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
