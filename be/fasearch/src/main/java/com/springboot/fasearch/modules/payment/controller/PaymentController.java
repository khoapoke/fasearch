package com.springboot.fasearch.modules.payment.controller;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.payment.dto.request.PaymentCalculateReq;
import com.springboot.fasearch.modules.payment.dto.request.PaymentProcessReq;
import com.springboot.fasearch.modules.payment.dto.response.InvoiceRes;
import com.springboot.fasearch.modules.payment.dto.response.PaymentCalculationRes;
import com.springboot.fasearch.modules.payment.dto.response.PaymentMethodRes;
import com.springboot.fasearch.modules.payment.service.interfaces.PaymentService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping("/methods")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<List<PaymentMethodRes>> getPaymentMethods() {
        List<PaymentMethodRes> result = paymentService.getPaymentMethods();
        return ApiResponse.success(200, "Lấy danh sách phương thức thanh toán thành công", result);
    }

    @PostMapping("/calculate")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    public ResponseEntity<ApiResponse<PaymentCalculationRes>> calculatePayment(@Valid @RequestBody PaymentCalculateReq req) {
        PaymentCalculationRes result = paymentService.calculatePayment(req);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(200, "Tính toán hóa đơn thành công", result));
    }

    @PostMapping("/process")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    public ResponseEntity<ApiResponse<InvoiceRes>> processPayment(@Valid @RequestBody PaymentProcessReq req) {
        var result = paymentService.processPayment(req);
        int code = result.replayed() ? 200 : 201;
        return ResponseEntity.status(code).cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(code, "Thanh toán và xuất hóa đơn thành công", result.receipt()));
    }
}
