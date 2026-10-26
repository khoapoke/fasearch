package com.springboot.fasearch.modules.product.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.product.entity.ProductVariant;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    boolean existsByBarcode(String barcode);

    boolean existsByBarcodeAndIdNot(String barcode, Long id);

    Optional<ProductVariant> findByBarcode(String barcode);

    List<ProductVariant> findByProductId(Long productId);

    boolean existsByProductIdAndColorIgnoreCaseAndSizeIgnoreCase(Long productId, String color, String size);

    boolean existsByProductIdAndColorIgnoreCaseAndSizeIgnoreCaseAndIdNot(Long productId, String color, String size, Long id);
}
