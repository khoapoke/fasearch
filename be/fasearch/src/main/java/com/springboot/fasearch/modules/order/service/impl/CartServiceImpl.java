package com.springboot.fasearch.modules.order.service.impl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CartQuoteRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.order.dto.request.CartItemReq;
import com.springboot.fasearch.modules.order.dto.request.CartItemUpdateReq;
import com.springboot.fasearch.modules.order.dto.response.CartItemRes;
import com.springboot.fasearch.modules.order.dto.response.CartRes;
import com.springboot.fasearch.modules.order.entity.Cart;
import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.CartItemId;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
import com.springboot.fasearch.modules.order.service.interfaces.CartService;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CartServiceImpl implements CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ProductVariantRepository productVariantRepository;
    private final InventoryRepository inventoryRepository;
    private final CheckoutBenefitService checkoutBenefitService;

    private Customer getCurrentCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        String username = auth.getName();
        return userRepository.findByAccount_Username(username)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
    }

    private Cart getOrCreateCart(Customer customer) {
        return cartRepository.findByCustomerIdForUpdate(customer.getId())
                .orElseGet(() -> cartRepository.save(Cart.builder()
                        .customer(customer)
                        .totalItems(0)
                        .build()));
    }

    private CartRes buildCartResponse(Cart cart) {
        List<CartItem> items = cartItemRepository.findById_CartId(cart.getId());

        List<CartItemRes> itemResponses = new ArrayList<>();
        BigDecimal subTotal = BigDecimal.ZERO;
        int totalQuantity = 0;

        for (CartItem item : items) {
            ProductVariant variant = item.getVariant();
            Product product = variant.getProduct();

            BigDecimal basePrice = product.getPrice();
            BigDecimal additionalPrice = variant.getAdditionalPrice() != null ? variant.getAdditionalPrice() : BigDecimal.ZERO;
            BigDecimal unitPrice = basePrice.add(additionalPrice);
            BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(item.getQuantity()));

            subTotal = subTotal.add(totalPrice);
            totalQuantity += item.getQuantity();

            itemResponses.add(CartItemRes.builder()
                    .skuId(variant.getId())
                    .productName(product.getProductName())
                    .color(variant.getColor())
                    .size(variant.getSize())
                    .barcode(variant.getBarcode())
                    .imageUrl(product.getImageUrl())
                    .unitPrice(unitPrice)
                    .quantity(item.getQuantity())
                    .totalPrice(totalPrice)
                    .build());
        }

        cart.setTotalItems(totalQuantity);
        cartRepository.save(cart);

        return CartRes.builder()
                .cartId(cart.getId())
                .totalItems(totalQuantity)
                .subTotal(subTotal)
                .items(itemResponses)
                .build();
    }

    @Override
    @Transactional
    public CartRes getMyCart() {
        Customer customer = getCurrentCustomer();
        Cart cart = getOrCreateCart(customer);
        return buildCartResponse(cart);
    }

    @Override
    @Transactional(readOnly = true)
    public CartQuoteResponse quote(CartQuoteRequest request) {
        Customer customer = getCurrentCustomer();
        Cart cart = cartRepository.findByCustomerId(customer.getId())
                .orElseThrow(() -> new com.springboot.fasearch.exception.AppException(
                        com.springboot.fasearch.exception.ErrorCode.CART_EMPTY));
        return checkoutBenefitService.quote(cartItemRepository.findById_CartId(cart.getId()), request.getVoucherCode());
    }

    @Override
    @Transactional
    public CartRes addItemToCart(CartItemReq req) {
        Customer customer = getCurrentCustomer();
        Cart cart = getOrCreateCart(customer);

        ProductVariant variant = productVariantRepository.findById(req.getSkuId())
                .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND));

        Inventory inventory = inventoryRepository.findByVariantId(variant.getId())
                .orElseThrow(() -> new AppException(ErrorCode.INSUFFICIENT_STOCK));

        CartItemId cartItemId = new CartItemId(cart.getId(), variant.getId());
        CartItem cartItem = cartItemRepository.findById(cartItemId).orElse(null);

        int currentQty = cartItem != null ? cartItem.getQuantity() : 0;
        int targetQty = currentQty + req.getQuantity();

        if (inventory.getAvailableStock() < targetQty) {
            throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
        }

        if (cartItem != null) {
            cartItem.setQuantity(targetQty);
            cartItemRepository.save(cartItem);
        } else {
            CartItem newItem = CartItem.builder()
                    .id(cartItemId)
                    .cart(cart)
                    .variant(variant)
                    .quantity(targetQty)
                    .build();
            cartItemRepository.save(newItem);
        }

        return buildCartResponse(cart);
    }

    @Override
    @Transactional
    public CartRes updateItemQuantity(Long skuId, CartItemUpdateReq req) {
        Customer customer = getCurrentCustomer();
        Cart cart = getOrCreateCart(customer);

        CartItemId cartItemId = new CartItemId(cart.getId(), skuId);
        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new AppException(ErrorCode.CART_ITEM_NOT_FOUND));

        Inventory inventory = inventoryRepository.findByVariantId(skuId)
                .orElseThrow(() -> new AppException(ErrorCode.INSUFFICIENT_STOCK));

        if (inventory.getAvailableStock() < req.getQuantity()) {
            throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
        }

        cartItem.setQuantity(req.getQuantity());
        cartItemRepository.save(cartItem);

        return buildCartResponse(cart);
    }

    @Override
    @Transactional
    public CartRes removeItemFromCart(Long skuId) {
        Customer customer = getCurrentCustomer();
        Cart cart = getOrCreateCart(customer);

        CartItemId cartItemId = new CartItemId(cart.getId(), skuId);
        if (!cartItemRepository.existsById(cartItemId)) {
            throw new AppException(ErrorCode.CART_ITEM_NOT_FOUND);
        }

        cartItemRepository.deleteById(cartItemId);

        return buildCartResponse(cart);
    }

    @Override
    @Transactional
    public void clearCart() {
        Customer customer = getCurrentCustomer();
        Cart cart = getOrCreateCart(customer);

        cartItemRepository.deleteAllByCartId(cart.getId());
        cart.setTotalItems(0);
        cartRepository.save(cart);
    }
}
