package com.springboot.fasearch.modules.product.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.product.dto.request.VariantCreateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantUpdateReq;
import com.springboot.fasearch.modules.product.dto.response.VariantRes;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.mapper.ProductMapper;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.product.service.interfaces.ProductVariantService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProductVariantServiceImpl implements ProductVariantService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductMapper productMapper;

    @Override
    @Transactional(readOnly = true)
    public List<VariantRes> getVariantsByProductId(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
        }
        List<ProductVariant> variants = productVariantRepository.findByProductId(productId);
        return productMapper.toVariantResponseList(variants);
    }

    @Override
    @Transactional(readOnly = true)
    public VariantRes getVariantById(Long variantId) {
        ProductVariant variant = productVariantRepository.findById(variantId)
                .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));
        return productMapper.toVariantResponse(variant);
    }

    @Override
    @Transactional
    public VariantRes addVariant(Long productId, VariantCreateReq req) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));

        String color = req.getColor().trim();
        String size = req.getSize().trim();

        if (productVariantRepository.existsByProductIdAndColorIgnoreCaseAndSizeIgnoreCase(productId, color, size)) {
            throw new AppException(ErrorCode.VARIANT_ALREADY_EXISTS);
        }

        String barcode = (req.getBarcode() != null && !req.getBarcode().isBlank()) ? req.getBarcode().trim() : null;
        if (barcode != null) {
            if (productVariantRepository.existsByBarcode(barcode)) {
                throw new AppException(ErrorCode.BARCODE_ALREADY_EXISTS);
            }
        } else {
            barcode = String.format("SP%04d-%s-%s", productId, color.toUpperCase(), size.toUpperCase());
            if (productVariantRepository.existsByBarcode(barcode)) {
                barcode = barcode + "-" + (System.currentTimeMillis() % 10000);
            }
        }

        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .color(color)
                .size(size)
                .barcode(barcode)
                .isDeleted(false)
                .build();

        ProductVariant saved = productVariantRepository.save(variant);
        return productMapper.toVariantResponse(saved);
    }

    @Override
    @Transactional
    public VariantRes updateVariant(Long variantId, VariantUpdateReq req) {
        ProductVariant variant = productVariantRepository.findById(variantId)
                .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));

        Long productId = variant.getProduct().getId();
        String newColor = (req.getColor() != null && !req.getColor().isBlank()) ? req.getColor().trim() : variant.getColor();
        String newSize = (req.getSize() != null && !req.getSize().isBlank()) ? req.getSize().trim() : variant.getSize();

        if (productVariantRepository.existsByProductIdAndColorIgnoreCaseAndSizeIgnoreCaseAndIdNot(productId, newColor, newSize, variantId)) {
            throw new AppException(ErrorCode.VARIANT_ALREADY_EXISTS);
        }

        if (req.getBarcode() != null && !req.getBarcode().isBlank()) {
            String newBarcode = req.getBarcode().trim();
            if (!newBarcode.equalsIgnoreCase(variant.getBarcode()) && productVariantRepository.existsByBarcodeAndIdNot(newBarcode, variantId)) {
                throw new AppException(ErrorCode.BARCODE_ALREADY_EXISTS);
            }
            variant.setBarcode(newBarcode);
        }

        if (req.getColor() != null && !req.getColor().isBlank()) {
            variant.setColor(newColor);
        }
        if (req.getSize() != null && !req.getSize().isBlank()) {
            variant.setSize(newSize);
        }

        ProductVariant saved = productVariantRepository.save(variant);
        return productMapper.toVariantResponse(saved);
    }

    @Override
    @Transactional
    public void deleteVariant(Long variantId) {
        ProductVariant variant = productVariantRepository.findById(variantId)
                .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));

        variant.setIsDeleted(true);
        productVariantRepository.save(variant);
    }
}
