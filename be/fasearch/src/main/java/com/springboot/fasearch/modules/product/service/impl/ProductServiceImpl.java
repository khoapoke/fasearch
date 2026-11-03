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
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
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
import com.springboot.fasearch.modules.product.mapper.ProductMapper;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.product.service.interfaces.ProductService;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final ProductMapper productMapper;

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

        Specification<Product> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(keyword)) {
                String search = "%" + keyword.trim().toLowerCase() + "%";
                predicates.add(cb.like(cb.lower(root.get("productName")), search));
            }

            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            if (brandId != null) {
                predicates.add(cb.equal(root.get("brand").get("id"), brandId));
            }

            if (StringUtils.hasText(brand)) {
                predicates.add(cb.equal(cb.lower(root.get("brand").get("slug")), brand.trim().toLowerCase()));
            }

            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
            }

            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            predicates.add(cb.equal(root.get("publicationStatus"), PublicationStatus.PUBLISHED));

            return cb.and(predicates.toArray(new Predicate[0]));
        };

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
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
        }

        return productMapper.toProductDetailResponse(product);
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
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand not found"));
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
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand not found"));
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
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        requireStaged(product, "delete");

        product.setIsDeleted(true);
        product.setStatus(ProductStatus.DISCONTINUED);

        for (ProductVariant variant : product.getVariants()) {
            variant.setIsDeleted(true);
        }

        productRepository.save(product);
        log.info("Soft deleted product ID [{}] and marked DISCONTINUED", id);
    }

    /** Published rows may only change through the staged draft/publish flow. */
    private void requireStaged(Product product, String action) {
        if (product.getPublicationStatus() == PublicationStatus.PUBLISHED) {
            throw new AppException(ErrorCode.DATA_CONFLICT,
                    "Product " + product.getId() + " is published; " + action
                            + " it through /api/v1/admin/products/drafts (staged publication)");
        }
    }
}
