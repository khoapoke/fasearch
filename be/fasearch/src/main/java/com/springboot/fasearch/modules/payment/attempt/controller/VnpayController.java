package com.springboot.fasearch.modules.payment.attempt.controller;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.payment.attempt.dto.PaymentEventCommand;
import com.springboot.fasearch.modules.payment.attempt.dto.request.PaymentAttemptCreateReq;
import com.springboot.fasearch.modules.payment.attempt.dto.request.ProviderCheckoutReq;
import com.springboot.fasearch.modules.payment.attempt.dto.response.PaymentAttemptRes;
import com.springboot.fasearch.modules.payment.attempt.dto.response.ProviderCheckoutRes;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentAttempt;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.attempt.entity.ProviderEventOutcome;
import com.springboot.fasearch.modules.payment.attempt.provider.VnpayCheckoutService;
import com.springboot.fasearch.modules.payment.attempt.provider.VnpaySignatureVerifier;
import com.springboot.fasearch.modules.payment.attempt.repository.PaymentAttemptRepository;
import com.springboot.fasearch.modules.payment.attempt.service.interfaces.PaymentAttemptService;
import com.springboot.fasearch.shared.ApiResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/payments/vnpay")
@RequiredArgsConstructor
public class VnpayController {
    private final PaymentAttemptService paymentAttemptService;
    private final PaymentAttemptRepository attemptRepository;
    private final VnpayCheckoutService vnpayCheckoutService;
    private final VnpaySignatureVerifier signatureVerifier;

    @Value("${VNPAY_TMN_CODE:}")
    private String tmnCode;
    @Value("${VNPAY_HASH_SECRET:}")
    private String hashSecret;

    @PostMapping("/checkout")
    @PreAuthorize("hasRole('CUSTOMER')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProviderCheckoutRes> checkout(@Valid @RequestBody ProviderCheckoutReq request, HttpServletRequest http) {
        PaymentAttemptCreateReq attemptReq = new PaymentAttemptCreateReq();
        attemptReq.setOrderId(request.getOrderId());
        attemptReq.setProvider(PaymentProvider.VNPAY);
        attemptReq.setIdempotencyKey(request.getIdempotencyKey());
        PaymentAttemptRes attempt = paymentAttemptService.create(attemptReq);
        if (attempt.getCheckoutUrl() != null && !attempt.getCheckoutUrl().isBlank()) {
            return ApiResponse.success(201, "VNPAY checkout đã tồn tại",
                    ProviderCheckoutRes.builder().attemptId(attempt.getId()).checkoutUrl(attempt.getCheckoutUrl()).build());
        }
        VnpayCheckoutService.VnpayPaymentUrl payment = vnpayCheckoutService.createPaymentUrl(attempt, http.getRemoteAddr());
        paymentAttemptService.attachProviderSession(attempt.getId(), payment.txnRef(), payment.paymentUrl());
        return ApiResponse.success(201, "Tạo VNPAY checkout thành công",
                ProviderCheckoutRes.builder().attemptId(attempt.getId()).checkoutUrl(payment.paymentUrl()).build());
    }

    @GetMapping("/return")
    public Map<String, Object> displayReturn(@RequestParam Map<String, String> params) {
        boolean valid = signatureVerifier.verify(params, hashSecret);
        return Map.of("valid", valid, "displayOnly", true,
                "responseCode", params.getOrDefault("vnp_ResponseCode", ""),
                "transactionStatus", params.getOrDefault("vnp_TransactionStatus", ""),
                "txnRef", params.getOrDefault("vnp_TxnRef", ""));
    }

    @GetMapping("/ipn")
    public Map<String, String> ipn(@RequestParam Map<String, String> params) {
        if (!signatureVerifier.verify(params, hashSecret)) {
            return Map.of("RspCode", "97", "Message", "Invalid signature");
        }
        if (!tmnCode.equals(params.get("vnp_TmnCode"))) {
            return Map.of("RspCode", "99", "Message", "Invalid merchant");
        }
        String txnRef = params.getOrDefault("vnp_TxnRef", "");
        PaymentAttempt attempt = attemptRepository.findByProviderAndProviderReference(PaymentProvider.VNPAY, txnRef)
                .orElse(null);
        if (attempt == null) return Map.of("RspCode", "01", "Message", "Order not found");
        BigDecimal amount;
        try {
            amount = BigDecimal.valueOf(Long.parseLong(params.getOrDefault("vnp_Amount", "")), 2);
        } catch (NumberFormatException e) {
            return Map.of("RspCode", "04", "Message", "Invalid amount");
        }
        if (amount.compareTo(attempt.getAmount()) != 0 || !"VND".equalsIgnoreCase(params.get("vnp_CurrCode"))) {
            return Map.of("RspCode", "04", "Message", "Invalid amount");
        }
        boolean success = "00".equals(params.get("vnp_ResponseCode"))
                && "00".equals(params.get("vnp_TransactionStatus"));
        String eventId = txnRef + ":" + params.getOrDefault("vnp_TransactionNo", params.getOrDefault("vnp_ResponseCode", ""));
        String payloadHash = sha256(new TreeMap<>(params).toString());
        paymentAttemptService.recordProviderEvent(new PaymentEventCommand(PaymentProvider.VNPAY, eventId, txnRef,
                payloadHash, amount, "VND", success ? ProviderEventOutcome.SUCCESS : ProviderEventOutcome.FAILURE));
        return Map.of("RspCode", "00", "Message", "Confirm Success");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }
}
