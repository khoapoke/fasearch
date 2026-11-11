package com.springboot.fasearch.modules.product.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.product.dto.request.CategoryReq;
import com.springboot.fasearch.modules.product.dto.response.CategoryRes;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.mapper.CategoryMapper;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.service.interfaces.CategoryService;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final CategoryMapper categoryMapper;
    private final DeleteGuards deleteGuards;
    private final SoftDeleteRecorder softDeleteRecorder;

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

        if (categoryRepository.existsLiveName(trimmedName, null)) {
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
        if (categoryRepository.existsLiveName(newName, id)) {
            throw new AppException(ErrorCode.CATEGORY_NAME_ALREADY_EXISTS);
        }

        category.setCategoryName(newName);
        Category updated = categoryRepository.save(category);
        log.info("Updated category ID [{}] successfully", id);

        return categoryMapper.toCategoryResponse(updated);
    }

    @Override
    @Transactional
    public void deleteCategory(Long id, String reason) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        // A category keeps its FK on every product, including soft-deleted products, so the
        // guard counts all products that still reference it and not only the live ones.
        deleteGuards.assertCategoryDeletable(id);

        softDeleteRecorder.mark(category, reason);
        categoryRepository.save(category);

        log.info("Soft deleted category ID: {} (moved to trash)", id);
    }
}
