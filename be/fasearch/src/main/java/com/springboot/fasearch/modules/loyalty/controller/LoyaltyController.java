package com.springboot.fasearch.modules.loyalty.controller;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.loyalty.dto.response.CustomerLoyaltyPolicyRes;
import com.springboot.fasearch.modules.loyalty.dto.response.LedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.LoyaltyBalanceResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyCreateRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.LoyaltyPolicyResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyUpdateRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.SalesTierResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.SalesTierUpdateRequest;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/thanh-vien")
@RequiredArgsConstructor
@Validated
public class LoyaltyController {
    private final LoyaltyService loyaltyService;

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<LoyaltyBalanceResponse>> myBalance() {
        return noStore(ApiResponse.success(200, "Loyalty balance", loyaltyService.myBalance()));
    }

    @GetMapping("/chinh-sach-cua-toi")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<CustomerLoyaltyPolicyRes>> myPolicy() {
        return noStore(ApiResponse.success(200, "Customer loyalty policy", loyaltyService.myPolicy()));
    }

    @GetMapping("/lich-su")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<PageResponse<LedgerItemResponse>>> myHistory(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return noStore(ApiResponse.success(200, "Loyalty history", loyaltyService.myHistory(page, size)));
    }

    @GetMapping("/khach-hang/{customerId}")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public ResponseEntity<ApiResponse<LoyaltyBalanceResponse>> customerBalance(@PathVariable Long customerId) {
        return noStore(ApiResponse.success(200, "Customer loyalty balance", loyaltyService.customerBalance(customerId)));
    }

    @GetMapping("/chinh-sach")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<PageResponse<LoyaltyPolicyResponse>>> policies(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return noStore(ApiResponse.success(200, "Loyalty policies", loyaltyService.policies(page, size)));
    }

    @PostMapping("/chinh-sach")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<LoyaltyPolicyResponse>> createPolicy(
            @Valid @RequestBody LoyaltyPolicyCreateRequest request) {
        return noStore(HttpStatus.CREATED, ApiResponse.success(201, "Loyalty policy created", loyaltyService.createPolicy(request)));
    }

    @PutMapping("/chinh-sach/{policyId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<LoyaltyPolicyResponse>> updatePolicy(@PathVariable Long policyId,
            @Valid @RequestBody LoyaltyPolicyUpdateRequest request) {
        return noStore(ApiResponse.success(200, "Loyalty policy updated", loyaltyService.updatePolicy(policyId, request)));
    }

    @GetMapping("/chinh-sach/hang")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<List<SalesTierResponse>>> salesTiers() {
        return noStore(ApiResponse.success(200, "Sales tiers", loyaltyService.salesTiers()));
    }

    @PutMapping("/chinh-sach/hang/{tierId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<SalesTierResponse>> updateSalesTier(@PathVariable Long tierId,
            @Valid @RequestBody SalesTierUpdateRequest request) {
        return noStore(ApiResponse.success(200, "Sales tier updated", loyaltyService.updateSalesTier(tierId, request)));
    }

    private static <T> ResponseEntity<ApiResponse<T>> noStore(ApiResponse<T> body) {
        return noStore(HttpStatus.OK, body);
    }

    private static <T> ResponseEntity<ApiResponse<T>> noStore(HttpStatus status, ApiResponse<T> body) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
