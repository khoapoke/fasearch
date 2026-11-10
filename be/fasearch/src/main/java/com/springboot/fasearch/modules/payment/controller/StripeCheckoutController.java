package com.springboot.fasearch.modules.payment.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.payment.dto.request.PaymentAttemptCreateReq;
import com.springboot.fasearch.modules.payment.dto.request.ProviderCheckoutReq;
import com.springboot.fasearch.modules.payment.dto.response.PaymentAttemptRes;
import com.springboot.fasearch.modules.payment.dto.response.ProviderCheckoutRes;
import com.springboot.fasearch.modules.payment.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.client.StripeCheckoutService;
import com.springboot.fasearch.modules.payment.service.interfaces.PaymentAttemptService;
import com.springboot.fasearch.shared.ApiResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/payments/stripe")
@RequiredArgsConstructor
public class StripeCheckoutController {
    private final PaymentAttemptService paymentAttemptService;
    private final StripeCheckoutService stripeCheckoutService;

    @PostMapping("/checkout")
    @PreAuthorize("hasRole('CUSTOMER')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProviderCheckoutRes> checkout(@Valid @RequestBody ProviderCheckoutReq request) {
        PaymentAttemptCreateReq attemptReq = new PaymentAttemptCreateReq();
        attemptReq.setOrderId(request.getOrderId());
        attemptReq.setProvider(PaymentProvider.STRIPE);
        attemptReq.setIdempotencyKey(request.getIdempotencyKey());
        PaymentAttemptRes attempt = paymentAttemptService.create(attemptReq);
        if (attempt.getCheckoutUrl() != null && !attempt.getCheckoutUrl().isBlank()) {
            return ApiResponse.success(201, "Stripe Checkout đã tồn tại",
                    ProviderCheckoutRes.builder().attemptId(attempt.getId()).checkoutUrl(attempt.getCheckoutUrl()).build());
        }
        StripeCheckoutService.StripeSession session = stripeCheckoutService.createSession(attempt);
        paymentAttemptService.attachProviderSession(attempt.getId(), session.id(), session.url());
        return ApiResponse.success(201, "Tạo Stripe Checkout thành công",
                ProviderCheckoutRes.builder().attemptId(attempt.getId()).checkoutUrl(session.url()).build());
    }
}
