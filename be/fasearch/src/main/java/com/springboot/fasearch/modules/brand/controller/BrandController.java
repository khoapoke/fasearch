package com.springboot.fasearch.modules.brand.controller;

import java.time.Duration;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.brand.dto.response.BrandLogoData;
import com.springboot.fasearch.modules.brand.dto.response.BrandRes;
import com.springboot.fasearch.modules.brand.service.interfaces.BrandService;
import com.springboot.fasearch.shared.ApiResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/brands")
@RequiredArgsConstructor
public class BrandController {
    private final BrandService brandService;

    @GetMapping
    public ApiResponse<List<BrandRes>> list() {
        return ApiResponse.success(200, "Lấy danh sách thương hiệu thành công", brandService.list());
    }

    @GetMapping("/{slug}/logo")
    public ResponseEntity<byte[]> logo(@PathVariable String slug) {
        BrandLogoData logo = brandService.logo(slug);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(logo.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                .body(logo.bytes());
    }
}
