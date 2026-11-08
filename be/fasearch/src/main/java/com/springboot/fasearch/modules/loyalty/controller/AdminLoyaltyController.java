package com.springboot.fasearch.modules.loyalty.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.validation.annotation.Validated;
import com.springboot.fasearch.modules.loyalty.dto.request.PointsAdjustmentRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.AdminLedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.EarnRecalcResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.PointsAdjustmentResponse;
import com.springboot.fasearch.shared.PageResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
@Validated
public class AdminLoyaltyController {
    private final LoyaltyService loyaltyService;

    @PostMapping("/mo-dau")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<LegacyOpeningResponse>> openLegacyBalance(
            @Valid @RequestBody LegacyOpeningRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(201, "Legacy balance opened", loyaltyService.openLegacyBalance(request)));
    }

    @GetMapping("/khach-hang/{customerId}/lich-su")
    @PreAuthorize("hasAuthority('PERM_CUSTOMER_VIEW')")
    public ResponseEntity<ApiResponse<PageResponse<AdminLedgerItemResponse>>> customerHistory(
            @PathVariable Long customerId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(200, "Customer loyalty history", loyaltyService.customerHistory(customerId, page, size)));
    }

    /** Permission LOYALTY_ADJUST (off for Quản lý by default); the service re-checks the same permission. */
    @PostMapping("/khach-hang/{customerId}/dieu-chinh")
    @PreAuthorize("hasAuthority('PERM_LOYALTY_ADJUST')")
    public ResponseEntity<ApiResponse<PointsAdjustmentResponse>> adjustPoints(@PathVariable Long customerId,
            @Valid @RequestBody PointsAdjustmentRequest request) {
        PointsAdjustmentResponse result = loyaltyService.adjustPoints(customerId, request);
        return ResponseEntity.status(result.isReplayed() ? HttpStatus.OK : HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(result.isReplayed() ? 200 : 201, "Points adjusted", result));
    }

    @GetMapping("/don-hang/{orderId}/tinh-lai-diem")
    @PreAuthorize("hasAuthority('PERM_LOYALTY_ADJUST')")
    public ResponseEntity<ApiResponse<EarnRecalcResponse>> previewRecalc(@PathVariable Long orderId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(200, "Earn recalculation preview", loyaltyService.previewEarnRecalc(orderId)));
    }

    @PostMapping("/don-hang/{orderId}/tinh-lai-diem")
    @PreAuthorize("hasAuthority('PERM_LOYALTY_ADJUST')")
    public ResponseEntity<ApiResponse<EarnRecalcResponse>> recalc(@PathVariable Long orderId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(200, "Earn recalculated", loyaltyService.recalculateEarn(orderId)));
    }
}
