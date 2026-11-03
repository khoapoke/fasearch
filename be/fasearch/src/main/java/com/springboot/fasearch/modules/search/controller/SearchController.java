package com.springboot.fasearch.modules.search.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.search.dto.request.TextSearchReq;
import com.springboot.fasearch.modules.search.dto.response.AiSearchRes;
import com.springboot.fasearch.modules.search.service.interfaces.SearchService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
public class SearchController {

    private final SearchService searchService;

    /**
     * Phục vụ ảnh kết quả AI qua BE: FE không gọi trực tiếp cổng AI, không lộ đường dẫn nội bộ.
     * Chỉ nhận tên file an toàn (client kiểm tra allowlist) và trả cache private.
     */
    @GetMapping("/images/{fileName}")
    public ResponseEntity<byte[]> image(@PathVariable String fileName) {
        var image = searchService.downloadDatasetImage(fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .header("Cache-Control", "private, max-age=3600")
                .body(image.bytes());
    }

    @PostMapping("/text")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<AiSearchRes> searchByText(@Valid @RequestBody TextSearchReq req) {
        AiSearchRes result = searchService.searchByText(req);
        return ApiResponse.success(200, "Tìm kiếm theo văn bản thành công", result);
    }

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<AiSearchRes> searchByImage(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "limit", defaultValue = "5") Integer limit
    ) {
        MultipartFile uploadFile = file != null ? file : image;
        if (uploadFile == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng chọn file ảnh để tìm kiếm");
        }
        AiSearchRes result = searchService.searchByImage(uploadFile, limit);
        return ApiResponse.success(200, "Tìm kiếm theo hình ảnh thành công", result);
    }

    @PostMapping(value = "/multimodal", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<AiSearchRes> searchMultimodal(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "textQuery", required = false) String textQuery,
            @RequestParam(value = "limit", defaultValue = "5") Integer limit,
            @RequestParam(value = "text_weight", defaultValue = "0.5") Float textWeight
    ) {
        MultipartFile uploadFile = file != null ? file : image;
        if (uploadFile == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng chọn file ảnh gốc để tìm kiếm đa phương thức");
        }
        String searchQuery = query != null ? query : textQuery;
        if (searchQuery == null || searchQuery.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng nhập câu mô tả bổ sung");
        }
        AiSearchRes result = searchService.searchMultimodal(uploadFile, searchQuery, limit, textWeight);
        return ApiResponse.success(200, "Tìm kiếm đa phương thức kết hợp thành công", result);
    }
}

