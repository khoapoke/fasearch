package com.springboot.fasearch.modules.product.service.interfaces;

import java.util.List;

import com.springboot.fasearch.modules.product.dto.request.CategoryReq;
import com.springboot.fasearch.modules.product.dto.response.CategoryRes;

public interface CategoryService {

    List<CategoryRes> getAllCategories();

    CategoryRes getCategoryById(Long id);

    CategoryRes createCategory(CategoryReq req);

    CategoryRes updateCategory(Long id, CategoryReq req);

    void deleteCategory(Long id);
}
