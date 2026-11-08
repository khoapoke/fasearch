package com.springboot.fasearch.modules.product;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.product.mapper.ProductMapper;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.product.service.impl.ProductServiceImpl;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

class ProductPublicationFilterTest {

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private ProductServiceImpl service(ProductRepository repo) {
        return new ProductServiceImpl(repo, mock(ProductVariantRepository.class),
                mock(InventoryRepository.class), mock(CategoryRepository.class),
                mock(BrandRepository.class), mock(ProductMapper.class),
                mock(com.springboot.fasearch.modules.trash.service.impl.DeleteGuards.class),
                new com.springboot.fasearch.common.softdelete.SoftDeleteRecorder(mock(com.springboot.fasearch.modules.auth.repository.AccountRepository.class)));
    }

    private void asAnonymous() {
        SecurityContextHolder.getContext().setAuthentication(
                new AnonymousAuthenticationToken("anon", "anonymousUser",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
    }

    private void asRole(String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(role.toLowerCase(), "x",
                        com.springboot.fasearch.security.TestAuthorities.forRole(role)));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private CriteriaBuilder stubbedBuilder(Root root, Path pubPath, Path statusPath) {
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        when(root.get("publicationStatus")).thenReturn(pubPath);
        when(root.get("status")).thenReturn(statusPath);
        when(cb.equal(any(), any())).thenReturn(mock(Predicate.class));
        when(cb.and(any(Predicate[].class))).thenReturn(mock(Predicate.class));
        return cb;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private boolean publicationPredicateApplied(ProductRepository repo, ProductStatus status) {
        when(repo.findAll(any(Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));
        service(repo).getProducts(PageRequest.of(0, 10), null, null, null, null, status, null, null);
        ArgumentCaptor<Specification> captor = ArgumentCaptor.forClass(Specification.class);
        verify(repo).findAll(captor.capture(), any(org.springframework.data.domain.Pageable.class));
        Specification spec = captor.getValue();

        Root root = mock(Root.class);
        CriteriaQuery query = mock(CriteriaQuery.class);
        Path pubPath = mock(Path.class);
        Path statusPath = mock(Path.class);
        CriteriaBuilder cb = stubbedBuilder(root, pubPath, statusPath);
        spec.toPredicate(root, query, cb);
        try {
            verify(cb).equal(pubPath, PublicationStatus.PUBLISHED);
            return true;
        } catch (AssertionError e) {
            return false;
        }
    }

    // Dead assertPublication helper removed: every test asserts the predicate directly.

    @Test
    void anonymousNullStatusKeepsPublicationFilter() {
        asAnonymous();
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertTrue(publicationPredicateApplied(repo, null));
    }

    @Test
    void anonymousDiscontinuedKeepsPublicationFilter() {
        asAnonymous();
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertTrue(
                publicationPredicateApplied(repo, ProductStatus.DISCONTINUED));
    }

    @Test
    void customerNullStatusKeepsPublicationFilter() {
        asRole("CUSTOMER");
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertTrue(publicationPredicateApplied(repo, null));
    }

    @Test
    void customerDiscontinuedKeepsPublicationFilter() {
        asRole("CUSTOMER");
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertTrue(
                publicationPredicateApplied(repo, ProductStatus.DISCONTINUED));
    }

    @Test
    void staffNullStatusWidensList() {
        asRole("STAFF");
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertFalse(publicationPredicateApplied(repo, null));
    }

    @Test
    void staffDiscontinuedWidensList() {
        asRole("STAFF");
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertFalse(
                publicationPredicateApplied(repo, ProductStatus.DISCONTINUED));
    }

    @Test
    void adminNullStatusWidensList() {
        asRole("ADMIN");
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertFalse(publicationPredicateApplied(repo, null));
    }

    @Test
    void adminDiscontinuedWidensList() {
        asRole("ADMIN");
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertFalse(
                publicationPredicateApplied(repo, ProductStatus.DISCONTINUED));
    }

    @Test
    void noAuthNullStatusKeepsPublicationFilter() {
        SecurityContextHolder.clearContext();
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertTrue(publicationPredicateApplied(repo, null));
    }

    @Test
    void staffActiveStillRequiresPublished() {
        asRole("STAFF");
        ProductRepository repo = mock(ProductRepository.class);
        when(repo.findAll(any(Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));
        service(repo).getProducts(PageRequest.of(0, 10), null, null, null, null,
                ProductStatus.ACTIVE, null, null);
        ArgumentCaptor<Specification> captor = ArgumentCaptor.forClass(Specification.class);
        verify(repo).findAll(captor.capture(), any(org.springframework.data.domain.Pageable.class));
        Root root = mock(Root.class);
        CriteriaQuery query = mock(CriteriaQuery.class);
        Path pubPath = mock(Path.class);
        Path statusPath = mock(Path.class);
        CriteriaBuilder cb = stubbedBuilder(root, pubPath, statusPath);
        captor.getValue().toPredicate(root, query, cb);
        verify(cb).equal(pubPath, PublicationStatus.PUBLISHED);
        verify(cb).equal(statusPath, ProductStatus.ACTIVE);
    }

    @Test
    void anonymousDraftKeepsPublicationFilter() {
        asAnonymous();
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertTrue(
                publicationPredicateApplied(repo, ProductStatus.DRAFT));
    }

    @Test
    void adminDraftWidensList() {
        asRole("ADMIN");
        ProductRepository repo = mock(ProductRepository.class);
        org.junit.jupiter.api.Assertions.assertFalse(
                publicationPredicateApplied(repo, ProductStatus.DRAFT));
    }

    // P2: getProductById must allow unpublished rows ONLY for ADMIN or STAFF.
    private com.springboot.fasearch.modules.product.entity.Product unpublishedProduct(Long id) {
        return com.springboot.fasearch.modules.product.entity.Product.builder().id(id)
                .productName("Quần jeans basic").price(new java.math.BigDecimal("299000"))
                .status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE)
                .publicationStatus(PublicationStatus.UNPUBLISHED).build();
    }

    private ProductServiceImpl serviceWithProduct(com.springboot.fasearch.modules.product.entity.Product product,
            com.springboot.fasearch.modules.product.mapper.ProductMapper mapper) {
        ProductRepository repo = mock(ProductRepository.class);
        when(repo.findById(product.getId())).thenReturn(java.util.Optional.of(product));
        return new ProductServiceImpl(repo, mock(ProductVariantRepository.class),
                mock(InventoryRepository.class), mock(CategoryRepository.class),
                mock(BrandRepository.class), mapper,
                mock(com.springboot.fasearch.modules.trash.service.impl.DeleteGuards.class),
                new com.springboot.fasearch.common.softdelete.SoftDeleteRecorder(mock(com.springboot.fasearch.modules.auth.repository.AccountRepository.class)));
    }

    @Test
    void anonymousGetUnpublishedThrows404() {
        asAnonymous();
        com.springboot.fasearch.modules.product.entity.Product product = unpublishedProduct(50L);
        ProductServiceImpl svc = serviceWithProduct(product, mock(com.springboot.fasearch.modules.product.mapper.ProductMapper.class));
        try {
            svc.getProductById(50L);
            throw new AssertionError("anonymous must get 404 for unpublished");
        } catch (com.springboot.fasearch.exception.AppException e) {
            org.junit.jupiter.api.Assertions.assertEquals(com.springboot.fasearch.exception.ErrorCode.PRODUCT_NOT_FOUND, e.getErrorCode());
        }
    }

    @Test
    void customerGetUnpublishedThrows404() {
        asRole("CUSTOMER");
        com.springboot.fasearch.modules.product.entity.Product product = unpublishedProduct(50L);
        ProductServiceImpl svc = serviceWithProduct(product, mock(com.springboot.fasearch.modules.product.mapper.ProductMapper.class));
        try {
            svc.getProductById(50L);
            throw new AssertionError("customer must get 404 for unpublished");
        } catch (com.springboot.fasearch.exception.AppException e) {
            org.junit.jupiter.api.Assertions.assertEquals(com.springboot.fasearch.exception.ErrorCode.PRODUCT_NOT_FOUND, e.getErrorCode());
        }
    }

    @Test
    void adminGetUnpublishedSucceeds() {
        asRole("ADMIN");
        com.springboot.fasearch.modules.product.entity.Product product = unpublishedProduct(50L);
        com.springboot.fasearch.modules.product.mapper.ProductMapper mapper = mock(com.springboot.fasearch.modules.product.mapper.ProductMapper.class);
        com.springboot.fasearch.modules.product.dto.response.ProductDetailRes detail =
                com.springboot.fasearch.modules.product.dto.response.ProductDetailRes.builder().id(50L)
                        .productName("Quần jeans basic").status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE)
                        .variants(java.util.List.of()).build();
        when(mapper.toProductDetailResponse(product)).thenReturn(detail);
        ProductServiceImpl svc = serviceWithProduct(product, mapper);
        org.junit.jupiter.api.Assertions.assertEquals(50L, svc.getProductById(50L).getId());
    }

    @Test
    void staffGetUnpublishedSucceeds() {
        asRole("STAFF");
        com.springboot.fasearch.modules.product.entity.Product product = unpublishedProduct(50L);
        com.springboot.fasearch.modules.product.mapper.ProductMapper mapper = mock(com.springboot.fasearch.modules.product.mapper.ProductMapper.class);
        com.springboot.fasearch.modules.product.dto.response.ProductDetailRes detail =
                com.springboot.fasearch.modules.product.dto.response.ProductDetailRes.builder().id(50L)
                        .productName("Quần jeans basic").status(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE)
                        .variants(java.util.List.of()).build();
        when(mapper.toProductDetailResponse(product)).thenReturn(detail);
        ProductServiceImpl svc = serviceWithProduct(product, mapper);
        org.junit.jupiter.api.Assertions.assertEquals(50L, svc.getProductById(50L).getId());
    }

}
