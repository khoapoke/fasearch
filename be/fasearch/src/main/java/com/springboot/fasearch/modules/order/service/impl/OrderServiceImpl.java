package com.springboot.fasearch.modules.order.service.impl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.order.dto.request.CheckoutReq;
import com.springboot.fasearch.modules.order.dto.response.OrderRes;
import com.springboot.fasearch.modules.order.entity.Cart;
import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.entity.OrderDetailId;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.service.interfaces.OrderService;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final InventoryRepository inventoryRepository;

    private Customer getCurrentCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        String username = auth.getName();
        return userRepository.findByAccount_Username(username)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
    }

    private String generateOrderCode() {
        String todayStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "DH-" + todayStr + "-";
        long count = orderRepository.countByOrderCodeStartingWith(prefix);
        int seq = (int) count + 1;
        String orderCode = String.format("%s%03d", prefix, seq);
        while (orderRepository.existsByOrderCode(orderCode)) {
            seq++;
            orderCode = String.format("%s%03d", prefix, seq);
        }
        return orderCode;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderRes checkout(CheckoutReq req) {
        Customer customer = getCurrentCustomer();

        Cart cart = cartRepository.findByCustomerId(customer.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CART_EMPTY));

        List<CartItem> cartItems = cartItemRepository.findById_CartId(cart.getId());
        if (cartItems.isEmpty()) {
            throw new AppException(ErrorCode.CART_EMPTY);
        }

        // 1. Xác định địa chỉ giao hàng
        String deliveryAddress = (req.getDeliveryAddress() != null && !req.getDeliveryAddress().isBlank())
                ? req.getDeliveryAddress().trim()
                : customer.getAddress();

        if (deliveryAddress == null || deliveryAddress.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Địa chỉ nhận hàng không được để trống");
        }

        // 2. Định dạng ghi chú (bổ sung tên/SĐT người nhận nếu có)
        StringBuilder noteBuilder = new StringBuilder();
        boolean hasCustomReceiver = (req.getReceiverName() != null && !req.getReceiverName().isBlank())
                || (req.getReceiverPhone() != null && !req.getReceiverPhone().isBlank());
        if (hasCustomReceiver) {
            String defaultCustomerName = ((customer.getFirstName() != null ? customer.getFirstName() + " " : "")
                    + (customer.getLastName() != null ? customer.getLastName() : "")).trim();
            String receiverName = (req.getReceiverName() != null && !req.getReceiverName().isBlank())
                    ? req.getReceiverName().trim()
                    : defaultCustomerName;
            String receiverPhone = (req.getReceiverPhone() != null && !req.getReceiverPhone().isBlank())
                    ? req.getReceiverPhone().trim()
                    : customer.getPhoneNumber();
            noteBuilder.append(String.format("[Người nhận: %s - %s] ", receiverName, receiverPhone));
        }
        if (req.getNote() != null && !req.getNote().isBlank()) {
            noteBuilder.append(req.getNote().trim());
        }
        String finalNote = noteBuilder.length() > 0 ? noteBuilder.toString() : null;

        // 3. Khóa tồn kho (Reserved stock - FR-40) và tính toán tiền hàng
        BigDecimal subTotal = BigDecimal.ZERO;
        List<OrderDetail> orderDetails = new ArrayList<>();

        for (CartItem item : cartItems) {
            ProductVariant variant = item.getVariant();
            Inventory inventory = inventoryRepository.findByVariantId(variant.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.INSUFFICIENT_STOCK));

            if (inventory.getAvailableStock() < item.getQuantity()) {
                throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
            }

            // Tạm giữ tồn kho: giảm khả dụng, tăng tạm giữ
            inventory.setAvailableStock(inventory.getAvailableStock() - item.getQuantity());
            inventory.setReservedStock(inventory.getReservedStock() + item.getQuantity());
            inventoryRepository.save(inventory);

            // Tính đơn giá: basePrice + additionalPrice
            BigDecimal basePrice = variant.getProduct().getPrice();
            BigDecimal additionalPrice = variant.getAdditionalPrice() != null
                    ? variant.getAdditionalPrice()
                    : BigDecimal.ZERO;
            BigDecimal unitPrice = basePrice.add(additionalPrice);
            BigDecimal itemTotal = unitPrice.multiply(BigDecimal.valueOf(item.getQuantity()));

            subTotal = subTotal.add(itemTotal);

            OrderDetail detail = OrderDetail.builder()
                    .id(new OrderDetailId(null, variant.getId()))
                    .variant(variant)
                    .quantity(item.getQuantity())
                    .unitPrice(unitPrice)
                    .build();
            orderDetails.add(detail);
        }

        // 4. Tính toán phí vận chuyển, giảm giá, tổng tiền
        BigDecimal shippingFee = req.getShippingFee() != null ? req.getShippingFee() : BigDecimal.ZERO;
        BigDecimal discountAmount = BigDecimal.ZERO; // Sẽ tích hợp thêm voucher ở Module Promotion (FR-47)
        BigDecimal totalAmount = subTotal.subtract(discountAmount).add(shippingFee);

        // 5. Khởi tạo và lưu Order
        String orderCode = generateOrderCode();
        Order order = Order.builder()
                .orderCode(orderCode)
                .customer(customer)
                .employee(null) // Đơn online do khách tự đặt
                .status(OrderStatus.PENDING)
                .deliveryAddress(deliveryAddress)
                .shippingFee(shippingFee)
                .discountAmount(discountAmount)
                .totalAmount(totalAmount)
                .note(finalNote)
                .build();

        for (OrderDetail detail : orderDetails) {
            detail.setOrder(order);
        }
        order.setDetails(orderDetails);

        Order savedOrder = orderRepository.save(order);

        // 6. Xóa sạch giỏ hàng của khách sau khi chốt đơn thành công
        cartItemRepository.deleteAllByCartId(cart.getId());
        cart.setTotalItems(0);
        cartRepository.save(cart);

        return OrderRes.builder()
                .orderId(savedOrder.getId())
                .orderCode(savedOrder.getOrderCode())
                .status(savedOrder.getStatus())
                .subTotal(subTotal)
                .discountAmount(savedOrder.getDiscountAmount())
                .shippingFee(savedOrder.getShippingFee())
                .totalAmount(savedOrder.getTotalAmount())
                .createdAt(savedOrder.getOrderDate())
                .build();
    }
}
