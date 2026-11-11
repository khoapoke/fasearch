package com.springboot.fasearch.modules.inventory.repository;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.springboot.fasearch.common.search.SearchTextNormalizer;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.product.entity.ProductVariant;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

/** The stock list filters, shared by the admin list page and the CSV export. */
public final class InventorySpecifications {

    private InventorySpecifications() {
    }

    public static Specification<Inventory> list(String sku, String productName, String keyword) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<Inventory, ProductVariant> variantJoin = root.join("variant", JoinType.LEFT);
            Join<Object, Object> productJoin = variantJoin.join("product", JoinType.LEFT);

            if (sku != null && !sku.isBlank()) {
                String cleanSku = SearchTextNormalizer.clamp(sku);
                Predicate skuIdMatch = cb.disjunction();
                if (cleanSku.matches("^\\d{1,18}$")) {
                    try {
                        skuIdMatch = cb.equal(variantJoin.get("id"), Long.parseLong(cleanSku));
                    } catch (NumberFormatException ignored) {
                    }
                }
                Predicate barcodeMatch = cb.like(cb.lower(variantJoin.get("barcode")),
                        "%" + SearchTextNormalizer.escapeLike(cleanSku) + "%",
                        SearchTextNormalizer.LIKE_ESCAPE);
                predicates.add(cb.or(skuIdMatch, barcodeMatch));
            }

            if (productName != null && !productName.isBlank()) {
                String productPattern = SearchTextNormalizer.containsPattern(productName);
                if (productPattern != null) {
                    predicates.add(cb.like(productJoin.get("searchText"), productPattern,
                            SearchTextNormalizer.LIKE_ESCAPE));
                }
            }

            String keywordPattern = SearchTextNormalizer.containsPattern(keyword);
            if (keywordPattern != null) {
                predicates.add(cb.or(
                        cb.like(variantJoin.get("searchText"), keywordPattern, SearchTextNormalizer.LIKE_ESCAPE),
                        cb.like(productJoin.get("searchText"), keywordPattern, SearchTextNormalizer.LIKE_ESCAPE)));
            }

            // Stock of a soft-deleted SKU (or of a SKU whose product is soft-deleted) is not part
            // of the live list, so aggregates and rows must exclude the same set.
            predicates.add(cb.isFalse(variantJoin.get("isDeleted")));
            predicates.add(cb.isFalse(productJoin.get("isDeleted")));

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
