package com.springboot.fasearch.modules.product;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import com.springboot.fasearch.modules.product.dto.response.VariantRes;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.mapper.ProductMapper;

/** Sentinel flags distinguish provider placeholders from real customer choices. */
class VariantSentinelFlagsTest {

    private final ProductMapper mapper = Mappers.getMapper(ProductMapper.class);

    private ProductVariant variant(String color, String size) {
        ProductVariant variant = new ProductVariant();
        variant.setId(1L);
        variant.setColor(color);
        variant.setSize(size);
        return variant;
    }

    @Test
    void defaultTitleColorIsSentinel() {
        VariantRes res = mapper.toVariantResponse(variant("Default Title", "M"));
        assertTrue(res.isColorIsSentinel());
        assertFalse(res.isSizeIsSentinel());
    }

    @Test
    void unknownSizeIsSentinel() {
        VariantRes res = mapper.toVariantResponse(variant("Den", "Không xác định"));
        assertFalse(res.isColorIsSentinel());
        assertTrue(res.isSizeIsSentinel());
    }

    @Test
    void fullySentinelVariant3124() {
        VariantRes res = mapper.toVariantResponse(variant("Default Title", "Không xác định"));
        assertTrue(res.isColorIsSentinel());
        assertTrue(res.isSizeIsSentinel());
    }

    @Test
    void realChoiceIsNotSentinel() {
        VariantRes res = mapper.toVariantResponse(variant("Den", "M"));
        assertFalse(res.isColorIsSentinel());
        assertFalse(res.isSizeIsSentinel());
    }

    @Test
    void nullOptionsAreNotSentinel() {
        VariantRes res = mapper.toVariantResponse(variant(null, null));
        assertFalse(res.isColorIsSentinel());
        assertFalse(res.isSizeIsSentinel());
    }
}
