package com.springboot.fasearch.modules.publish.controller;

import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftUpdateReq;
import com.springboot.fasearch.modules.publish.dto.response.AdminDraftRes;
import com.springboot.fasearch.modules.publish.dto.response.AiSyncRes;
import com.springboot.fasearch.modules.publish.dto.response.PublishRes;
import com.springboot.fasearch.modules.publish.service.interfaces.PublishService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/admin/products")
@SecurityRequirement(name = "BearerAuth")
@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
@RequiredArgsConstructor
public class AdminProductPublishController {

    private final PublishService publishService;

    @PostMapping("/drafts")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AdminDraftRes> createDraft(@Valid @RequestBody AdminDraftCreateReq request) {
        return ApiResponse.success(201, "Tạo bản nháp thành công", publishService.createDraft(request));
    }

    @PutMapping("/drafts/{draftId}")
    public ApiResponse<AdminDraftRes> updateDraft(@PathVariable Long draftId,
            @Valid @RequestBody AdminDraftUpdateReq request) {
        return ApiResponse.success(200, "Cập nhật bản nháp thành công", publishService.updateDraft(draftId, request));
    }

    @GetMapping("/drafts/{draftId}")
    public ApiResponse<AdminDraftRes> getDraft(@PathVariable Long draftId) {
        return ApiResponse.success(200, "Lấy bản nháp thành công", publishService.getDraft(draftId));
    }

    @GetMapping("/drafts")
    public ApiResponse<PageResponse<AdminDraftRes>> listDrafts(
            @PageableDefault(page = 0, size = 20) Pageable pageable,
            @RequestParam(value = "productId", required = false) Long productId) {
        return ApiResponse.success(200, "Lấy danh sách bản nháp thành công",
                publishService.listDrafts(pageable, productId));
    }

    @GetMapping("/drafts/{draftId}/images/{fileName}")
    public org.springframework.http.ResponseEntity<byte[]> readDraftImage(@PathVariable Long draftId,
            @PathVariable String fileName) {
        byte[] bytes = publishService.readDraftImage(draftId, fileName);
        String lower = fileName.toLowerCase(java.util.Locale.ROOT);
        org.springframework.http.MediaType type = lower.endsWith(".png")
                ? org.springframework.http.MediaType.IMAGE_PNG
                : org.springframework.http.MediaType.IMAGE_JPEG;
        return org.springframework.http.ResponseEntity.ok()
                .contentType(type)
                .header("Cache-Control", "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(bytes);
    }

    @DeleteMapping("/drafts/{draftId}")
    public ApiResponse<Void> deleteDraft(@PathVariable Long draftId) {
        publishService.deleteDraft(draftId);
        return ApiResponse.success(200, "Xóa bản nháp thành công", null);
    }

    @PostMapping(value = "/drafts/{draftId}/images", consumes = "multipart/form-data")
    public ApiResponse<String> uploadDraftImage(@PathVariable Long draftId,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.success(200, "Tải ảnh nháp thành công", publishService.uploadDraftImage(draftId, file));
    }

    public record PublishReq(Long expectedVersion) {
    }

    @PostMapping("/drafts/{draftId}/publish")
    public ApiResponse<PublishRes> publish(@PathVariable Long draftId, @RequestBody(required = false) PublishReq body) {
        Long expectedVersion = body == null ? null : body.expectedVersion();
        if (expectedVersion == null) {
            throw new com.springboot.fasearch.exception.AppException(
                    com.springboot.fasearch.exception.ErrorCode.INVALID_REQUEST, "expectedVersion is required");
        }
        return ApiResponse.success(200, "Xuất bản thành công", publishService.publishDraft(draftId, expectedVersion));
    }

    public record UnpublishReq(String reason) {
    }

    @PostMapping("/{productId}/unpublish")
    public ApiResponse<PublishRes> unpublish(@PathVariable Long productId,
            @RequestBody(required = false) UnpublishReq body) {
        return ApiResponse.success(200, "Gỡ xuất bản thành công",
                publishService.unpublishProduct(productId, body == null ? null : body.reason()));
    }

    @GetMapping("/{productId}/ai-sync")
    public ApiResponse<AiSyncRes> aiSyncState(@PathVariable Long productId) {
        return ApiResponse.success(200, "Lấy trạng thái đồng bộ AI thành công",
                publishService.aiSyncState(productId));
    }

    @PostMapping("/{productId}/ai-sync/retry")
    public ApiResponse<AiSyncRes> retryAiSync(@PathVariable Long productId) {
        return ApiResponse.success(200, "Thử đồng bộ AI thành công", publishService.retryAiSync(productId));
    }

    @PostMapping("/import-url")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AdminDraftRes> importFromUrl(@RequestBody java.util.Map<String, String> body) {
        String url = body == null ? null : body.get("url");
        if (url == null || url.isBlank()) {
            throw new com.springboot.fasearch.exception.AppException(
                    com.springboot.fasearch.exception.ErrorCode.INVALID_REQUEST, "url is required");
        }
        return ApiResponse.success(201, "Nhập từ URL thành công", publishService.importFromUrl(url.strip()));
    }
}
