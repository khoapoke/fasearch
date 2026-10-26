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

import com.springboot.fasearch.modules.product.dto.request.VariantCreateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantUpdateReq;
import com.springboot.fasearch.modules.product.dto.response.VariantRes;
import com.springboot.fasearch.modules.product.service.interfaces.ProductVariantService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
@Tag(name = "Product Variants", description = "Quản lý biến thể sản phẩm (FR-26)")
public class ProductVariantController {

    private final ProductVariantService productVariantService;

    @Operation(summary = "Lấy danh sách biến thể theo sản phẩm (FR-26)")
    @GetMapping("/{productId}/variants")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<List<VariantRes>> getVariantsByProductId(@PathVariable Long productId) {
        List<VariantRes> result = productVariantService.getVariantsByProductId(productId);
        return ApiResponse.success(200, "Lấy danh sách biến thể thành công", result);
    }

    @Operation(summary = "Lấy thông tin chi tiết một biến thể (FR-26)")
    @GetMapping("/variants/{variantId}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<VariantRes> getVariantById(@PathVariable Long variantId) {
        VariantRes result = productVariantService.getVariantById(variantId);
        return ApiResponse.success(200, "Lấy thông tin biến thể thành công", result);
    }

    @Operation(summary = "Thêm mới biến thể cho sản phẩm (FR-26)")
    @PostMapping("/{productId}/variants")
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<VariantRes> addVariant(
            @PathVariable Long productId,
            @Valid @RequestBody VariantCreateReq req) {
        VariantRes result = productVariantService.addVariant(productId, req);
        return ApiResponse.success(201, "Thêm mới biến thể thành công", result);
    }

    @Operation(summary = "Cập nhật thông tin biến thể (FR-26)")
    @RequestMapping(value = "/variants/{variantId}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<VariantRes> updateVariant(
            @PathVariable Long variantId,
            @Valid @RequestBody VariantUpdateReq req) {
        VariantRes result = productVariantService.updateVariant(variantId, req);
        return ApiResponse.success(200, "Cập nhật biến thể thành công", result);
    }

    @Operation(summary = "Xóa biến thể sản phẩm (FR-26)")
    @DeleteMapping("/variants/{variantId}")
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> deleteVariant(@PathVariable Long variantId) {
        productVariantService.deleteVariant(variantId);
        return ApiResponse.success(200, "Xóa biến thể thành công", true);
    }
}
