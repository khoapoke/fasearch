package com.springboot.fasearch.modules.product.repository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.common.search.SearchTextNormalizer;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

/** The admin/storefront product filters, shared by the list page and the CSV export. */
public final class ProductSpecifications {

    private ProductSpecifications() {
    }

    public static Specification<Product> list(
            String keyword,
            Long categoryId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            ProductStatus status,
            String brand,
            Long brandId,
            boolean privileged) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Storefront search keeps matching the product name only; staff also reach the
            // model code, product id, brand and SKUs of the same catalogue row.
            String keywordPattern = SearchTextNormalizer.containsPattern(keyword);
            if (keywordPattern != null) {
                List<Predicate> matches = new ArrayList<>();
                matches.add(cb.like(root.get("searchText"), keywordPattern, SearchTextNormalizer.LIKE_ESCAPE));
                if (privileged) {
                    matches.add(cb.like(cb.lower(root.get("modelCode")), keywordPattern,
                            SearchTextNormalizer.LIKE_ESCAPE));
                    String clamped = SearchTextNormalizer.clamp(keyword);
                    if (clamped.matches("\\d{1,18}")) {
                        matches.add(cb.equal(root.get("id"), Long.parseLong(clamped)));
                    }
                    Join<Product, ?> brandJoin = root.join("brand", JoinType.LEFT);
                    matches.add(cb.like(brandJoin.get("searchText"), keywordPattern,
                            SearchTextNormalizer.LIKE_ESCAPE));
                    Subquery<Long> variantMatch = query.subquery(Long.class);
                    Root<ProductVariant> variantRoot = variantMatch.from(ProductVariant.class);
                    variantMatch.select(variantRoot.get("id")).where(
                            cb.equal(variantRoot.get("product"), root),
                            cb.like(variantRoot.get("searchText"), keywordPattern,
                                    SearchTextNormalizer.LIKE_ESCAPE));
                    matches.add(cb.exists(variantMatch));
                }
                predicates.add(cb.or(matches.toArray(new Predicate[0])));
            }

            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            if (brandId != null) {
                predicates.add(cb.equal(root.get("brand").get("id"), brandId));
            }

            if (org.springframework.util.StringUtils.hasText(brand)) {
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

            // Public storefront and customers always see only published rows, for every status value.
            // Only staff or admin callers may list unpublished rows: all rows when no status is given,
            // and the never-published discontinued/draft rows by status.
            if (!privileged) {
                predicates.add(cb.equal(root.get("publicationStatus"), PublicationStatus.PUBLISHED));
            } else if (status == ProductStatus.ACTIVE || status == ProductStatus.OUT_OF_STOCK) {
                predicates.add(cb.equal(root.get("publicationStatus"), PublicationStatus.PUBLISHED));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
