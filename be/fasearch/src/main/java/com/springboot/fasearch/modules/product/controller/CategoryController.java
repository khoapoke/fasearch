package com.springboot.fasearch.modules.product.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.product.dto.request.CategoryReq;
import com.springboot.fasearch.modules.product.dto.response.CategoryRes;
import com.springboot.fasearch.modules.product.service.interfaces.CategoryService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping("/with-counts")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<List<CategoryRes>> getCategoriesWithCounts() {
        List<CategoryRes> result = categoryService.getCategoriesWithCounts();
        return ApiResponse.success(200, "Lấy danh mục kèm số lượng thành công", result);
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<List<CategoryRes>> getAllCategories() {
        List<CategoryRes> result = categoryService.getAllCategories();
        return ApiResponse.success(200, "Lấy danh mục thành công", result);
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CategoryRes> getCategoryById(@PathVariable Long id) {
        CategoryRes result = categoryService.getCategoryById(id);
        return ApiResponse.success(200, "Lấy chi tiết danh mục thành công", result);
    }

    @PostMapping
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CategoryRes> createCategory(@Valid @RequestBody CategoryReq req) {
        CategoryRes result = categoryService.createCategory(req);
        return ApiResponse.success(201, "Thêm mới danh mục thành công", result);
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CategoryRes> updateCategory(
            @PathVariable Long id,
            @Valid @RequestBody CategoryReq req) {
        CategoryRes result = categoryService.updateCategory(id, req);
        return ApiResponse.success(200, "Cập nhật danh mục thành công", result);
    }

    @DeleteMapping("/{id}")
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ApiResponse.success(200, "Xóa danh mục thành công", true);
    }
}
