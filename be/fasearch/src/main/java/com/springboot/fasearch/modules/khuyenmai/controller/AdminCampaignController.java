package com.springboot.fasearch.modules.khuyenmai.controller;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CampaignCreateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CampaignUpdateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CodeCreateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CampaignResponse;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CodeResponse;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.KhuyenMaiService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/khuyen-mai")
@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
@RequiredArgsConstructor
public class AdminCampaignController {
    private final KhuyenMaiService khuyenMaiService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CampaignResponse> create(@Valid @RequestBody CampaignCreateRequest request) {
        return ApiResponse.success(201, "Tạo chương trình thành công", khuyenMaiService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<CampaignResponse> update(@PathVariable Long id, @Valid @RequestBody CampaignUpdateRequest request) {
        return ApiResponse.success(200, "Cập nhật thành công", khuyenMaiService.update(id, request));
    }

    @GetMapping("/{id}")
    public ApiResponse<CampaignResponse> get(@PathVariable Long id) {
        return ApiResponse.success(200, "Lấy chi tiết thành công", khuyenMaiService.get(id));
    }

    @GetMapping
    public ApiResponse<PageResponse<CampaignResponse>> list(
            @RequestParam(required = false) String trangThai,
            @RequestParam(required = false) String loai,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100 || (q != null && q.length() > 100)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid page, size, or search query bounds");
        }
        return ApiResponse.success(200, "Lấy danh sách thành công",
                khuyenMaiService.list(trangThai, loai, q, PageRequest.of(page, size)));
    }

    @PostMapping("/{id}/codes")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CodeResponse> createCode(@PathVariable Long id, @Valid @RequestBody CodeCreateRequest request) {
        return ApiResponse.success(201, "Phát hành mã thành công", khuyenMaiService.createCode(id, request));
    }
}
