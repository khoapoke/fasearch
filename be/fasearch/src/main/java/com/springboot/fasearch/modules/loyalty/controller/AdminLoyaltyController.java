package com.springboot.fasearch.modules.loyalty.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.loyalty.dto.request.LegacyOpeningRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.LegacyOpeningResponse;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.shared.ApiResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/quan-tri/thanh-vien")
@RequiredArgsConstructor
public class AdminLoyaltyController {
    private final LoyaltyService loyaltyService;

    @PostMapping("/mo-dau")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<LegacyOpeningResponse>> openLegacyBalance(
            @Valid @RequestBody LegacyOpeningRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(201, "Legacy balance opened", loyaltyService.openLegacyBalance(request)));
    }
}
