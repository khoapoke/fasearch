package com.springboot.fasearch.modules.csv;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.domain.Specification;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.search.SearchTextNormalizer;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventorySpecifications;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderSpecifications;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.CustomerSpecifications;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

/** The export specifications keep the same filters as the list pages they mirror. */
class CsvSpecificationsTest {

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void orderExportAppliesStatusKeywordPhoneAndDateFilters() {
        Root<Order> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        Path<String> searchText = mock(Path.class);
        Path<LocalDateTime> orderDate = mock(Path.class);
        Path<OrderStatus> status = mock(Path.class);
        Join<Order, Object> customer = mock(Join.class);
        Path<String> phone = mock(Path.class);
        Path<String> name = mock(Path.class);
        Predicate predicate = mock(Predicate.class);

        when(root.<String>get("searchText")).thenReturn(searchText);
        when(root.<LocalDateTime>get("orderDate")).thenReturn(orderDate);
        when(root.<OrderStatus>get("status")).thenReturn(status);
        when(root.join("customer", JoinType.LEFT)).thenReturn((Join) customer);
        when(root.join("customer")).thenReturn((Join) customer);
        when(customer.<String>get("phoneNumber")).thenReturn(phone);
        when(customer.<String>get("searchText")).thenReturn(name);
        when(cb.like(any(Expression.class), any(String.class), any(char.class))).thenReturn(predicate);
        when(cb.equal(any(Expression.class), any())).thenReturn(predicate);
        when(cb.or(any(Predicate.class), any(Predicate.class))).thenReturn(predicate);
        when(cb.greaterThanOrEqualTo(any(Expression.class), any(LocalDateTime.class))).thenReturn(predicate);
        when(cb.lessThanOrEqualTo(any(Expression.class), any(LocalDateTime.class))).thenReturn(predicate);
        when(cb.and(any(Predicate[].class))).thenReturn(predicate);

        Specification<Order> spec = OrderSpecifications.list(null, OrderStatus.SHIPPING, "DH-1", "0901",
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 7), "Minh");
        spec.toPredicate(root, query, cb);

        verify(cb).equal(status, OrderStatus.SHIPPING);
        verify(cb).like(phone, "%0901%", SearchTextNormalizer.LIKE_ESCAPE);
        verify(cb).like(searchText, "%dh-1%", SearchTextNormalizer.LIKE_ESCAPE);
        verify(cb).like(searchText, "%minh%", SearchTextNormalizer.LIKE_ESCAPE);
        verify(cb).greaterThanOrEqualTo(orderDate, LocalDate.of(2026, 11, 1).atStartOfDay());
        verify(cb).lessThan(orderDate, LocalDate.of(2026, 11, 8).atStartOfDay());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void stockExportExcludesSoftDeletedSkusAndProducts() {
        Root<Inventory> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        Join<Inventory, Object> variant = mock(Join.class);
        Join<Object, Object> product = mock(Join.class);
        Path<String> variantSearch = mock(Path.class);
        Path<String> productSearch = mock(Path.class);
        Path<Boolean> variantDeleted = mock(Path.class);
        Path<Boolean> productDeleted = mock(Path.class);
        Predicate predicate = mock(Predicate.class);

        when(root.join("variant", JoinType.LEFT)).thenReturn((Join) variant);
        when(variant.join("product", JoinType.LEFT)).thenReturn(product);
        when(variant.<String>get("searchText")).thenReturn(variantSearch);
        when(product.<String>get("searchText")).thenReturn(productSearch);
        when(variant.<Boolean>get("isDeleted")).thenReturn(variantDeleted);
        when(product.<Boolean>get("isDeleted")).thenReturn(productDeleted);
        when(cb.isFalse(any(Expression.class))).thenReturn(predicate);
        when(cb.like(any(Expression.class), any(String.class), any(char.class))).thenReturn(predicate);
        when(cb.or(any(Predicate.class), any(Predicate.class))).thenReturn(predicate);
        when(cb.and(any(Predicate[].class))).thenReturn(predicate);

        InventorySpecifications.list(null, null, "áo").toPredicate(root, query, cb);

        verify(cb).isFalse(variantDeleted);
        verify(cb).isFalse(productDeleted);
        verify(cb).like(variantSearch, "%ao%", SearchTextNormalizer.LIKE_ESCAPE);
        verify(cb).like(productSearch, "%ao%", SearchTextNormalizer.LIKE_ESCAPE);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void customerExportKeepsTheKeywordEmailJoin() {
        Root<Customer> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        Path<String> searchText = mock(Path.class);
        Join<Customer, Object> account = mock(Join.class);
        Path<String> email = mock(Path.class);
        Expression<String> lowerEmail = mock(Expression.class);
        Predicate predicate = mock(Predicate.class);

        when(root.<String>get("searchText")).thenReturn(searchText);
        when(root.join("account", JoinType.LEFT)).thenReturn((Join) account);
        when(account.<String>get("email")).thenReturn(email);
        when(cb.lower(email)).thenReturn(lowerEmail);
        when(cb.like(any(Expression.class), any(String.class), any(char.class))).thenReturn(predicate);
        when(cb.or(any(Predicate.class), any(Predicate.class))).thenReturn(predicate);
        when(cb.and(any(Predicate[].class))).thenReturn(predicate);

        CustomerSpecifications.list("minh@example.com", null, null,
                mock(com.springboot.fasearch.modules.user.repository.MembershipTierRepository.class))
                .toPredicate(root, query, cb);

        verify(cb).like(searchText, "%minh@example.com%", SearchTextNormalizer.LIKE_ESCAPE);
        verify(cb).like(lowerEmail, "%minh@example.com%", SearchTextNormalizer.LIKE_ESCAPE);
    }
}
