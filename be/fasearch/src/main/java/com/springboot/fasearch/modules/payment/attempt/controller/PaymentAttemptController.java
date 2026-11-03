package com.springboot.fasearch.modules.payment.attempt.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.payment.attempt.dto.request.PaymentAttemptCreateReq;
import com.springboot.fasearch.modules.payment.attempt.dto.response.PaymentAttemptRes;
import com.springboot.fasearch.modules.payment.attempt.service.interfaces.PaymentAttemptService;
import com.springboot.fasearch.shared.ApiResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/payments/attempts")
@PreAuthorize("hasRole('CUSTOMER')")
@RequiredArgsConstructor
public class PaymentAttemptController {
    private final PaymentAttemptService paymentAttemptService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PaymentAttemptRes> create(@Valid @RequestBody PaymentAttemptCreateReq request) {
        return ApiResponse.success(201, "Tạo payment attempt thành công", paymentAttemptService.create(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<PaymentAttemptRes> get(@PathVariable Long id) {
        return ApiResponse.success(200, "Lấy payment attempt thành công", paymentAttemptService.get(id));
    }
}
