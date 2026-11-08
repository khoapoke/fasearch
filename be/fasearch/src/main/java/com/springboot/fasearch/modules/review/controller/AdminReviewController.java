package com.springboot.fasearch.modules.review.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.review.dto.request.ReviewVisibilityReq;
import com.springboot.fasearch.modules.review.dto.response.ReviewRes;
import com.springboot.fasearch.modules.review.service.interfaces.ReviewService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/admin/reviews")
@RequiredArgsConstructor
@Validated
public class AdminReviewController {
    private final ReviewService reviewService;

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_REVIEW_MODERATE')")
    public ResponseEntity<ApiResponse<PageResponse<ReviewRes>>> list(
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Boolean hidden,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(200,
                "Lấy danh sách đánh giá quản trị thành công", reviewService.adminList(productId, hidden, page, size)));
    }

    @PatchMapping("/{reviewId}/visibility")
    @PreAuthorize("hasAuthority('PERM_REVIEW_MODERATE')")
    public ResponseEntity<ApiResponse<ReviewRes>> setVisibility(@PathVariable Long reviewId,
            @Valid @RequestBody ReviewVisibilityReq request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(200,
                "Cập nhật trạng thái hiển thị đánh giá thành công", reviewService.setVisibility(reviewId, request)));
    }
}
