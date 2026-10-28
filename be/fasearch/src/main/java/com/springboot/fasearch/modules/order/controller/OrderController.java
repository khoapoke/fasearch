package com.springboot.fasearch.modules.order.controller;

import java.time.LocalDate;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.modules.order.dto.request.CheckoutReq;
import com.springboot.fasearch.modules.order.dto.request.OrderCancelReq;
import com.springboot.fasearch.modules.order.dto.request.OrderStatusUpdateReq;
import com.springboot.fasearch.modules.order.dto.response.OrderDetailRes;
import com.springboot.fasearch.modules.order.dto.response.OrderRes;
import com.springboot.fasearch.modules.order.service.interfaces.OrderService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<OrderRes> checkout(@Valid @RequestBody CheckoutReq req) {
        OrderRes result = orderService.checkout(req);
        return ApiResponse.success(201, "Tạo đơn hàng thành công", result);
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    public ApiResponse<PageResponse<OrderRes>> getOrders(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "orderDate", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String orderCode,
            @RequestParam(required = false) String customerPhone,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        PageResponse<OrderRes> result = orderService.getOrders(pageable, status, orderCode, customerPhone, startDate, endDate);
        return ApiResponse.success(200, "Lấy danh sách đơn hàng thành công", result);
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    public ApiResponse<OrderDetailRes> getOrderById(@PathVariable Long id) {
        OrderDetailRes result = orderService.getOrderById(id);
        return ApiResponse.success(200, "Lấy chi tiết đơn hàng thành công", result);
    }

    @PatchMapping("/{id}/status")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ApiResponse<OrderDetailRes> updateOrderStatus(
            @PathVariable Long id,
            @Valid @RequestBody OrderStatusUpdateReq req) {
        OrderDetailRes result = orderService.updateOrderStatus(id, req);
        return ApiResponse.success(200, "Cập nhật trạng thái đơn hàng thành công", result);
    }

    @PostMapping("/{id}/cancel")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    public ApiResponse<OrderDetailRes> cancelOrder(
            @PathVariable Long id,
            @Valid @RequestBody OrderCancelReq req) {
        OrderDetailRes result = orderService.cancelOrder(id, req);
        return ApiResponse.success(200, "Hủy đơn hàng thành công", result);
    }
}
