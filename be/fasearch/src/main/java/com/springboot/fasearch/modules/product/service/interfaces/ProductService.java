package com.springboot.fasearch.modules.product.service.interfaces;

import java.math.BigDecimal;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.product.dto.request.ProductCreateReq;
import com.springboot.fasearch.modules.product.dto.request.ProductUpdateReq;
import com.springboot.fasearch.modules.product.dto.response.ProductDetailRes;
import com.springboot.fasearch.modules.product.dto.response.ProductRes;
import com.springboot.fasearch.shared.PageResponse;

public interface ProductService {

    PageResponse<ProductRes> getProducts(
            Pageable pageable,
            String keyword,
            Long categoryId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            ProductStatus status);

    ProductDetailRes getProductById(Long id);

    ProductDetailRes createProduct(ProductCreateReq req);

    ProductDetailRes updateProduct(Long id, ProductUpdateReq req);

    void deleteProduct(Long id);
}
