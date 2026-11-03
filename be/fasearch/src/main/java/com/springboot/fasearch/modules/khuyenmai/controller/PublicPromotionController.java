package com.springboot.fasearch.modules.khuyenmai.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.khuyenmai.dto.response.PublicOfferRes;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.KhuyenMaiService;
import com.springboot.fasearch.shared.ApiResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/promotions")
@RequiredArgsConstructor
public class PublicPromotionController {
    private final KhuyenMaiService khuyenMaiService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<List<PublicOfferRes>> list() {
        return ApiResponse.success(200, "Lấy danh sách ưu đãi công khai thành công",
                khuyenMaiService.listPublicOffers());
    }
}
