package com.springboot.fasearch.modules.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.modules.product.dto.response.CategoryRes;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.service.impl.CategoryServiceImpl;

/** with-counts exposes server-side published totals (FE must not infer from page 1). */
@ExtendWith(MockitoExtension.class)
class CategoryWithCountsTest {

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private com.springboot.fasearch.modules.product.repository.ProductRepository productRepository;

    @Mock
    private com.springboot.fasearch.modules.product.mapper.CategoryMapper categoryMapper;

    @InjectMocks
    private CategoryServiceImpl service;

    @Test
    void mapsRowsToCounts() {
        when(categoryRepository.findNonEmptyWithPublishedCounts()).thenReturn(List.of(
                new Object[] { 104L, "Áo", 1106L },
                new Object[] { 106L, "Khác", 184L }));
        List<CategoryRes> result = service.getCategoriesWithCounts();
        assertEquals(2, result.size());
        assertEquals(104L, result.get(0).getId());
        assertEquals("Áo", result.get(0).getCategoryName());
        assertEquals(1106L, result.get(0).getProductCount());
        assertEquals(184L, result.get(1).getProductCount());
    }
}
