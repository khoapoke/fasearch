package com.springboot.fasearch.modules.product.service.impl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.common.search.SearchTextNormalizer;
import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;
import com.springboot.fasearch.security.Permission;
import com.springboot.fasearch.security.SecurityUtils;
import com.springboot.fasearch.modules.product.dto.request.ProductCreateReq;
import com.springboot.fasearch.modules.product.dto.request.ProductUpdateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantReq;
import com.springboot.fasearch.modules.product.dto.response.ProductDetailRes;
import com.springboot.fasearch.modules.product.dto.response.ProductRes;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.product.mapper.ProductMapper;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductSpecifications;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.product.service.interfaces.ProductService;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final InventoryRepository inventoryRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final ProductMapper productMapper;
    private final DeleteGuards deleteGuards;
    private final SoftDeleteRecorder softDeleteRecorder;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ProductRes> getProducts(
            Pageable pageable,
            String keyword,
            Long categoryId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            ProductStatus status,
            String brand,
            Long brandId) {
        // Decided once from the security context, never from a request parameter.
        boolean privileged = SecurityUtils.hasPermission(Permission.PRODUCT_VIEW);
        Specification<Product> spec = ProductSpecifications.list(
                keyword, categoryId, minPrice, maxPrice, status, brand, brandId, privileged);

        Page<Product> page = productRepository.findAll(spec, pageable);
        Page<ProductRes> resPage = page.map(productMapper::toProductResponse);

        return PageResponse.from(resPage);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductDetailRes getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        if (product.getPublicationStatus() != PublicationStatus.PUBLISHED) {
            boolean privileged = SecurityUtils.hasPermission(Permission.PRODUCT_VIEW);
            if (!privileged) {
                throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
            }
        }

        ProductDetailRes res = productMapper.toProductDetailResponse(product);
        // Storefront chỉ cần số khả dụng theo size (không lộ physical/reserved/threshold).
        // Null khi chưa có dòng tồn kho: FE coi như chưa rõ và không hiện số.
        if (res.getVariants() != null && !res.getVariants().isEmpty()) {
            java.util.List<Long> skuIds = res.getVariants().stream()
                    .map(v -> v.getSkuId())
                    .filter(java.util.Objects::nonNull)
                    .toList();
            if (!skuIds.isEmpty()) {
                java.util.Map<Long, Integer> avail = new java.util.HashMap<>();
                for (Inventory inv : inventoryRepository.findByVariantIdIn(skuIds)) {
                    if (inv.getVariant() != null && inv.getVariant().getId() != null) {
                        avail.put(inv.getVariant().getId(), inv.getAvailableStock());
                    }
                }
                for (var v : res.getVariants()) {
                    v.setAvailableStock(avail.getOrDefault(v.getSkuId(), null));
                }
            }
        }
        return res;
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.List<ProductRes> getRelatedProducts(Long id, int limit) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        if (product.getPublicationStatus() != PublicationStatus.PUBLISHED) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
        }
        // -1 không khớp id nào: thiếu danh mục/thương hiệu thì vế đó bị bỏ qua.
        Long categoryId = product.getCategory() == null ? -1L : product.getCategory().getId();
        Long brandId = product.getBrand() == null ? -1L : product.getBrand().getId();
        return productRepository.findRelated(id, categoryId, brandId, org.springframework.data.domain.PageRequest.of(0, Math.max(1, Math.min(12, limit))))
                .stream().map(productMapper::toProductResponse).toList();
    }

    @Override
    @Transactional
    public ProductDetailRes createProduct(ProductCreateReq req) {
        Category category = categoryRepository.findById(req.getCategoryId())
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        Product product = productMapper.toProduct(req);
        product.setCategory(category);
        if (req.getBrandId() != null) {
            Brand brand = brandRepository.findById(req.getBrandId())
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy thương hiệu."));
            product.setBrand(brand);
        }
        product.setIsDeleted(false);
        if (product.getStatus() == null) {
            product.setStatus(ProductStatus.ACTIVE);
        }
        // Legacy create is a staging back-path: nothing reaches the public catalog
        // until it is published through POST /api/v1/admin/products/drafts/{id}/publish.
        product.setPublicationStatus(PublicationStatus.DRAFT);
        product.setPublicationVersion(0L);

        Product savedProduct = productRepository.save(product);

        if (req.getVariants() != null && !req.getVariants().isEmpty()) {
            List<ProductVariant> variants = new ArrayList<>();
            int index = 1;
            for (VariantReq vReq : req.getVariants()) {
                String barcode = vReq.getBarcode();
                if (!StringUtils.hasText(barcode)) {
                    barcode = String.format("SP%04d-%s-%s", savedProduct.getId(),
                            StringUtils.hasText(vReq.getColor()) ? vReq.getColor().toUpperCase().trim() : "DEF",
                            StringUtils.hasText(vReq.getSize()) ? vReq.getSize().toUpperCase().trim() : String.valueOf(index));
                }

                if (productVariantRepository.existsByBarcode(barcode)) {
                    throw new AppException(ErrorCode.BARCODE_ALREADY_EXISTS);
                }

                ProductVariant variant = ProductVariant.builder()
                        .product(savedProduct)
                        .color(vReq.getColor())
                        .size(vReq.getSize())
                        .barcode(barcode)
                        .isDeleted(false)
                        .build();

                variants.add(variant);
                index++;
            }
            savedProduct.setVariants(variants);
            productVariantRepository.saveAll(variants);
        }

        log.info("Created product successfully with ID: {}", savedProduct.getId());
        return productMapper.toProductDetailResponse(savedProduct);
    }

    @Override
    @Transactional
    public ProductDetailRes updateProduct(Long id, ProductUpdateReq req) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        requireStaged(product, "edit");

        if (req.getCategoryId() != null) {
            Category category = categoryRepository.findById(req.getCategoryId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
            product.setCategory(category);
        }

        if (req.getBrandId() != null) {
            Brand brand = brandRepository.findById(req.getBrandId())
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy thương hiệu."));
            product.setBrand(brand);
        }

        productMapper.updateProductFromReq(req, product);

        if (req.getVariants() != null) {
            product.getVariants().clear();
            int index = 1;
            for (VariantReq vReq : req.getVariants()) {
                String barcode = vReq.getBarcode();
                if (!StringUtils.hasText(barcode)) {
                    barcode = String.format("SP%04d-%s-%s", product.getId(),
                            StringUtils.hasText(vReq.getColor()) ? vReq.getColor().toUpperCase().trim() : "DEF",
                            StringUtils.hasText(vReq.getSize()) ? vReq.getSize().toUpperCase().trim() : String.valueOf(index));
                }

                ProductVariant variant = ProductVariant.builder()
                        .product(product)
                        .color(vReq.getColor())
                        .size(vReq.getSize())
                        .barcode(barcode)
                        .isDeleted(false)
                        .build();

                product.getVariants().add(variant);
                index++;
            }
        }

        Product updated = productRepository.save(product);
        log.info("Updated product ID [{}] successfully", id);

        return productMapper.toProductDetailResponse(updated);
    }

    @Override
    @Transactional
    public void deleteProduct(Long id, String reason) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        if (product.getPublicationStatus() == PublicationStatus.PUBLISHED) {
            throw new AppException(ErrorCode.DELETE_BLOCKED_PUBLISHED,
                    "Sản phẩm đang được xuất bản nên chưa xóa được. Hãy gỡ xuất bản trước; sau đó xóa sẽ đưa sản phẩm vào thùng rác và có thể khôi phục.");
        }
        requireStaged(product, "delete");
        deleteGuards.assertProductDeletable(id);

        softDeleteRecorder.mark(product, reason);
        product.setStatus(ProductStatus.DISCONTINUED);

        for (ProductVariant variant : product.getVariants()) {
            if (!Boolean.TRUE.equals(variant.getIsDeleted())) {
                softDeleteRecorder.markWithParent(variant, product);
            }
        }

        productRepository.save(product);
        log.info("Soft deleted product ID [{}] with variants, moved to trash", id);
    }

    /** Published rows may only change through the staged draft/publish flow. */
    private void requireStaged(Product product, String action) {
        if (product.getPublicationStatus() == PublicationStatus.PUBLISHED) {
            String message = "delete".equals(action)
                    ? "Sản phẩm đang xuất bản nên không xóa được. Hãy gỡ xuất bản trước."
                    : "Sản phẩm đang xuất bản nên không sửa trực tiếp được. Hãy sửa qua bản nháp hoặc gỡ xuất bản trước.";
            throw new AppException(ErrorCode.DATA_CONFLICT, message);
        }
    }
}
