package com.springboot.fasearch.modules.order.service.interfaces;

import com.springboot.fasearch.modules.order.dto.request.CartItemReq;
import com.springboot.fasearch.modules.order.dto.request.CartItemUpdateReq;
import com.springboot.fasearch.modules.order.dto.response.CartRes;

public interface CartService {

    CartRes getMyCart();

    CartRes addItemToCart(CartItemReq req);

    CartRes updateItemQuantity(Long skuId, CartItemUpdateReq req);

    CartRes removeItemFromCart(Long skuId);

    void clearCart();
}
