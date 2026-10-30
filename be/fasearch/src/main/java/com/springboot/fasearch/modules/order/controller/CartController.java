package com.springboot.fasearch.modules.order.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.order.dto.request.CartItemReq;
import com.springboot.fasearch.modules.order.dto.request.CartItemUpdateReq;
import com.springboot.fasearch.modules.order.dto.response.CartRes;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CartQuoteRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;
import com.springboot.fasearch.modules.order.service.interfaces.CartService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/cart")
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@PreAuthorize("hasRole('CUSTOMER')")
public class CartController {

    private final CartService cartService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CartRes> getMyCart() {
        CartRes result = cartService.getMyCart();
        return ApiResponse.success(200, "Lấy thông tin giỏ hàng thành công", result);
    }

    @PostMapping("/quote")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CartQuoteResponse> quote(@Valid @RequestBody CartQuoteRequest req) {
        return ApiResponse.success(200, "Tính ưu đãi giỏ hàng thành công", cartService.quote(req));
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CartRes> addItemToCart(@Valid @RequestBody CartItemReq req) {
        CartRes result = cartService.addItemToCart(req);
        return ApiResponse.success(200, "Thêm sản phẩm vào giỏ hàng thành công", result);
    }

    @PutMapping("/items/{skuId}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CartRes> updateItemQuantity(
            @PathVariable Long skuId,
            @Valid @RequestBody CartItemUpdateReq req) {
        CartRes result = cartService.updateItemQuantity(skuId, req);
        return ApiResponse.success(200, "Cập nhật số lượng sản phẩm trong giỏ thành công", result);
    }

    @DeleteMapping("/items/{skuId}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CartRes> removeItemFromCart(@PathVariable Long skuId) {
        CartRes result = cartService.removeItemFromCart(skuId);
        return ApiResponse.success(200, "Xóa sản phẩm khỏi giỏ hàng thành công", result);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Void> clearCart() {
        cartService.clearCart();
        return ApiResponse.success(200, "Xóa sạch giỏ hàng thành công", null);
    }
}
