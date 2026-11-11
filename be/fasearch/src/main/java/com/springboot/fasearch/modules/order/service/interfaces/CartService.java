package com.springboot.fasearch.modules.order.service.interfaces;

import com.springboot.fasearch.modules.order.dto.request.CartItemReq;
import com.springboot.fasearch.modules.order.dto.request.CartItemUpdateReq;
import com.springboot.fasearch.modules.order.dto.response.CartRes;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CartQuoteRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;

public interface CartService {

    CartRes getMyCart();

    CartQuoteResponse quote(CartQuoteRequest request);

    CartRes addItemToCart(CartItemReq req);

    CartRes updateItemQuantity(Long skuId, CartItemUpdateReq req);

    CartRes removeItemFromCart(Long skuId);

    void clearCart();
}
