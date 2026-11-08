package com.springboot.fasearch.modules.product.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.modules.product.service.interfaces.ProductImageService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductImageController {

    private final ProductImageService productImageService;

    @PostMapping(value = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<String> uploadProductImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        String imageUrl = productImageService.uploadImage(id, file);
        return ApiResponse.success(200, "Tải ảnh sản phẩm thành công", imageUrl);
    }

    @DeleteMapping("/{id}/image")
    @SecurityRequirement(name = "BearerAuth")
    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Void> removeProductImage(@PathVariable Long id) {
        productImageService.removeImage(id);
        return ApiResponse.success(200, "Xóa ảnh sản phẩm thành công", null);
    }

    @GetMapping("/images/{fileName}")
    public ResponseEntity<byte[]> serveProductImage(@PathVariable String fileName) {
        var imageData = productImageService.serveImage(fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(imageData.contentType()))
                .header("Cache-Control", "private, max-age=3600")
                .body(imageData.bytes());
    }
}