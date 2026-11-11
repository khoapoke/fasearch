package com.springboot.fasearch.modules.search.controller;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.search.dto.request.SearchHistoryReq;
import com.springboot.fasearch.modules.search.dto.response.FavoriteRes;
import com.springboot.fasearch.modules.search.dto.response.SearchHistoryRes;
import com.springboot.fasearch.modules.search.service.interfaces.FavoriteService;
import com.springboot.fasearch.modules.search.service.interfaces.SearchHistoryService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/account")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
public class AccountSearchController {

    private final SearchHistoryService searchHistoryService;
    private final FavoriteService favoriteService;

    // --- Search History ---

    @PostMapping("/search-history")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SearchHistoryRes> recordSearchHistory(Authentication authentication,
            @Valid @RequestBody SearchHistoryReq req) {
        SearchHistoryRes response = searchHistoryService.record(authentication.getName(), req);
        return ApiResponse.success(201, "Ghi nhận lịch sử tìm kiếm thành công", response);
    }

    @GetMapping("/search-history")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<SearchHistoryRes>> listSearchHistory(Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        PageResponse<SearchHistoryRes> response = PageResponse.from(searchHistoryService.list(authentication.getName(), pageable));
        return ApiResponse.success(200, "Lấy lịch sử tìm kiếm thành công", response);
    }

    @DeleteMapping("/search-history/{id}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Void> removeSearchHistory(Authentication authentication, @PathVariable Long id) {
        searchHistoryService.remove(authentication.getName(), id);
        return ApiResponse.success(200, "Xóa lịch sử tìm kiếm thành công", null);
    }

    // --- Favorites ---

    @PostMapping("/favorites")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<FavoriteRes> addFavorite(Authentication authentication,
            @RequestParam Long productId) {
        FavoriteRes response = favoriteService.add(authentication.getName(), productId);
        return ApiResponse.success(201, "Thêm yêu thích thành công", response);
    }

    @DeleteMapping("/favorites/{productId}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Void> removeFavorite(Authentication authentication, @PathVariable Long productId) {
        favoriteService.remove(authentication.getName(), productId);
        return ApiResponse.success(200, "Xóa yêu thích thành công", null);
    }

    @GetMapping("/favorites")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<FavoriteRes>> listFavorites(Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        PageResponse<FavoriteRes> response = PageResponse.from(favoriteService.list(authentication.getName(), pageable));
        return ApiResponse.success(200, "Lấy danh sách yêu thích thành công", response);
    }
}