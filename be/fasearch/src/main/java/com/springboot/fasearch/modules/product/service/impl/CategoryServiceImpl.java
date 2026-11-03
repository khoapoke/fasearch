package com.springboot.fasearch.modules.product.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.product.dto.request.CategoryReq;
import com.springboot.fasearch.modules.product.dto.response.CategoryRes;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.mapper.CategoryMapper;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.service.interfaces.CategoryService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final CategoryMapper categoryMapper;

    @Override
    @Transactional(readOnly = true)
    public List<CategoryRes> getAllCategories() {
        List<Category> categories = categoryRepository.findAll();
        return categoryMapper.toCategoryResponseList(categories);
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryRes getCategoryById(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        return categoryMapper.toCategoryResponse(category);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryRes> getCategoriesWithCounts() {
        List<CategoryRes> result = new java.util.ArrayList<>();
        for (Object[] row : categoryRepository.findNonEmptyWithPublishedCounts()) {
            result.add(CategoryRes.builder()
                    .id(((Number) row[0]).longValue())
                    .categoryName((String) row[1])
                    .productCount(((Number) row[2]).longValue())
                    .build());
        }
        return result;
    }

    @Override
    @Transactional
    public CategoryRes createCategory(CategoryReq req) {
        String trimmedName = req.getCategoryName().trim();

        if (categoryRepository.existsByCategoryName(trimmedName)) {
            throw new AppException(ErrorCode.CATEGORY_NAME_ALREADY_EXISTS);
        }

        Category category = categoryMapper.toCategory(req);
        category.setCategoryName(trimmedName);
        category.setIsDeleted(false);

        Category saved = categoryRepository.save(category);
        log.info("Created category successfully with ID: {}", saved.getId());

        return categoryMapper.toCategoryResponse(saved);
    }

    @Override
    @Transactional
    public CategoryRes updateCategory(Long id, CategoryReq req) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        String newName = req.getCategoryName().trim();
        if (!newName.equalsIgnoreCase(category.getCategoryName())) {
            if (categoryRepository.existsByCategoryName(newName)) {
                throw new AppException(ErrorCode.CATEGORY_NAME_ALREADY_EXISTS);
            }
        }

        category.setCategoryName(newName);
        Category updated = categoryRepository.save(category);
        log.info("Updated category ID [{}] successfully", id);

        return categoryMapper.toCategoryResponse(updated);
    }

    @Override
    @Transactional
    public void deleteCategory(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        long productCount = productRepository.countByCategory_IdAndIsDeletedFalse(id);
        if (productCount > 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Không thể xóa danh mục đang có " + productCount + " sản phẩm tham chiếu. Vui lòng di chuyển hoặc xóa sản phẩm trước.");
        }

        category.setIsDeleted(true);
        categoryRepository.save(category);

        log.info("Soft deleted category ID: {}", id);
    }
}
