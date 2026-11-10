package com.springboot.fasearch.modules.order.repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.search.SearchTextNormalizer;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.user.entity.Customer;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

/** The order list filters, shared by the order list page and the CSV export. */
public final class OrderSpecifications {

    private OrderSpecifications() {
    }

    /**
     * @param customerId when not null, only orders of that customer (the CUSTOMER role); when
     *                   null the caller may filter by {@code customerPhone} (ADMIN/STAFF).
     */
    public static Specification<Order> list(
            Long customerId,
            OrderStatus status,
            String orderCode,
            String customerPhone,
            LocalDate startDate,
            LocalDate endDate,
            String keyword) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Data scope: a CUSTOMER only sees their own orders.
            if (customerId != null) {
                predicates.add(cb.equal(root.get("customer").get("id"), customerId));
            } else if (customerPhone != null && !customerPhone.isBlank()) {
                predicates.add(cb.like(root.join("customer").get("phoneNumber"),
                        "%" + SearchTextNormalizer.escapeLike(customerPhone.trim()) + "%",
                        SearchTextNormalizer.LIKE_ESCAPE));
            }

            // 2. Order code.
            String orderCodePattern = SearchTextNormalizer.containsPattern(orderCode);
            if (orderCodePattern != null) {
                predicates.add(cb.like(root.get("searchText"), orderCodePattern,
                        SearchTextNormalizer.LIKE_ESCAPE));
            }

            // 3. General keyword: order code, customer name or phone.
            String keywordPattern = SearchTextNormalizer.containsPattern(keyword);
            if (keywordPattern != null) {
                Join<Order, Customer> customerJoin = root.join("customer", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(root.get("searchText"), keywordPattern, SearchTextNormalizer.LIKE_ESCAPE),
                        cb.like(customerJoin.get("searchText"), keywordPattern,
                                SearchTextNormalizer.LIKE_ESCAPE)));
            }

            // 4. Status.
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            // 5. Order date range: whole calendar days (the order date is stored in Vietnam time, like the
            // reports), so the end day is inclusive and the bound is half-open at the next midnight.
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("orderDate"), startDate.atStartOfDay()));
            }
            if (endDate != null) {
                predicates.add(cb.lessThan(root.get("orderDate"), endDate.plusDays(1).atStartOfDay()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
