package com.springboot.fasearch.modules.review.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.review.dto.request.ReviewUpsertReq;
import com.springboot.fasearch.modules.review.dto.response.ReviewEligibilityRes;
import com.springboot.fasearch.modules.review.dto.response.ReviewRes;
import com.springboot.fasearch.modules.review.dto.response.ReviewSummaryRes;
import com.springboot.fasearch.modules.review.service.interfaces.ReviewService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/reviews/products/{productId}")
@RequiredArgsConstructor
@Validated
public class ReviewController {
    private final ReviewService reviewService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<ReviewRes>>> list(
            @PathVariable Long productId,
            @RequestParam(required = false) Integer rating,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size) {
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách đánh giá thành công",
                reviewService.list(productId, rating, sort, page, size)));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<ReviewSummaryRes>> summary(@PathVariable Long productId) {
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy tổng quan đánh giá thành công",
                reviewService.summary(productId)));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<ReviewEligibilityRes>> eligibility(@PathVariable Long productId) {
        return noStore(HttpStatus.OK, ApiResponse.success(200, "Kiểm tra quyền đánh giá thành công",
                reviewService.eligibility(productId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<ReviewRes>> create(@PathVariable Long productId,
            @Valid @RequestBody ReviewUpsertReq request) {
        return noStore(HttpStatus.CREATED, ApiResponse.success(201, "Gửi đánh giá thành công",
                reviewService.create(productId, request)));
    }

    @PutMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<ReviewRes>> update(@PathVariable Long productId,
            @Valid @RequestBody ReviewUpsertReq request) {
        return noStore(HttpStatus.OK, ApiResponse.success(200, "Cập nhật đánh giá thành công",
                reviewService.update(productId, request)));
    }

    @DeleteMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long productId) {
        reviewService.delete(productId);
        return noStore(HttpStatus.OK, ApiResponse.success(200, "Xóa đánh giá thành công", null));
    }

    private static <T> ResponseEntity<ApiResponse<T>> noStore(HttpStatus status, ApiResponse<T> body) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
