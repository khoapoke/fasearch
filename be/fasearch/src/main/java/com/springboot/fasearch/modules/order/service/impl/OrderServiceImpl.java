package com.springboot.fasearch.modules.order.service.impl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.order.dto.request.CheckoutReq;
import com.springboot.fasearch.modules.order.dto.request.OrderCancelReq;
import com.springboot.fasearch.modules.order.dto.request.OrderStatusUpdateReq;
import com.springboot.fasearch.modules.order.dto.request.PosDraftItemReq;
import com.springboot.fasearch.modules.order.dto.request.PosDraftOrderReq;
import com.springboot.fasearch.modules.order.dto.request.ShippingFeeCalcReq;
import com.springboot.fasearch.modules.order.dto.response.OrderCustomerRes;
import com.springboot.fasearch.modules.order.dto.response.OrderDetailRes;
import com.springboot.fasearch.modules.order.dto.response.OrderItemRes;
import com.springboot.fasearch.modules.order.dto.response.OrderRes;
import com.springboot.fasearch.modules.order.dto.response.ShippingFeeRes;
import com.springboot.fasearch.modules.order.entity.Cart;
import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.entity.OrderDetailId;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.service.interfaces.OrderService;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.Employee;
import com.springboot.fasearch.modules.user.repository.EmployeeRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final InventoryRepository inventoryRepository;
    private final ProductVariantRepository productVariantRepository;

    private Customer getCurrentCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        String username = auth.getName();
        return userRepository.findByAccount_Username(username)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
    }

    private boolean isCustomer(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + RoleType.CUSTOMER.name()));
    }

    private String getCustomerFullName(Customer customer) {
        if (customer == null) {
            return null;
        }
        String first = customer.getFirstName() != null ? customer.getFirstName() : "";
        String last = customer.getLastName() != null ? customer.getLastName() : "";
        return (first + " " + last).trim();
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

    private String generatePosOrderCode() {
        String todayStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "POS-" + todayStr + "-";
        long count = orderRepository.countByOrderCodeStartingWith(prefix);
        int seq = (int) count + 1;
        String orderCode = String.format("%s%03d", prefix, seq);
        while (orderRepository.existsByOrderCode(orderCode)) {
            seq++;
            orderCode = String.format("%s%03d", prefix, seq);
        }
        return orderCode;
    }

    private OrderDetailRes mapToOrderDetailRes(Order order) {
        List<OrderItemRes> items = new ArrayList<>();
        BigDecimal calculatedSubTotal = BigDecimal.ZERO;

        for (OrderDetail detail : order.getDetails()) {
            ProductVariant variant = detail.getVariant();
            Product product = variant.getProduct();
            BigDecimal lineTotal = detail.getUnitPrice().multiply(BigDecimal.valueOf(detail.getQuantity()));
            calculatedSubTotal = calculatedSubTotal.add(lineTotal);

            items.add(OrderItemRes.builder()
                    .skuId(variant.getId())
                    .productName(product != null ? product.getProductName() : null)
                    .color(variant.getColor())
                    .size(variant.getSize())
                    .imageUrl(product != null ? product.getImageUrl() : null)
                    .quantity(detail.getQuantity())
                    .unitPrice(detail.getUnitPrice())
                    .totalPrice(lineTotal)
                    .build());
        }

        OrderCustomerRes customerRes = null;
        if (order.getCustomer() != null) {
            customerRes = OrderCustomerRes.builder()
                    .customerId(order.getCustomer().getId())
                    .fullName(getCustomerFullName(order.getCustomer()))
                    .phoneNumber(order.getCustomer().getPhoneNumber())
                    .build();
        }

        return OrderDetailRes.builder()
                .orderId(order.getId())
                .orderCode(order.getOrderCode())
                .status(order.getStatus())
                .customer(customerRes)
                .deliveryAddress(order.getDeliveryAddress())
                .note(order.getNote())
                .items(items)
                .subTotal(calculatedSubTotal)
                .discountAmount(order.getDiscountAmount())
                .shippingFee(order.getShippingFee())
                .totalAmount(order.getTotalAmount())
                .createdAt(order.getOrderDate())
                .build();
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
            String defaultCustomerName = getCustomerFullName(customer);
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
                .customerName(getCustomerFullName(customer))
                .customerPhone(customer.getPhoneNumber())
                .deliveryAddress(savedOrder.getDeliveryAddress())
                .subTotal(subTotal)
                .discountAmount(savedOrder.getDiscountAmount())
                .shippingFee(savedOrder.getShippingFee())
                .totalAmount(savedOrder.getTotalAmount())
                .createdAt(savedOrder.getOrderDate())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<OrderRes> getOrders(
            Pageable pageable,
            OrderStatus status,
            String orderCode,
            String customerPhone,
            LocalDate startDate,
            LocalDate endDate) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        boolean isCust = isCustomer(auth);
        Customer currentCustomer = isCust
                ? userRepository.findByAccount_Username(auth.getName())
                        .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND))
                : null;

        Specification<Order> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Phân quyền dữ liệu: CUSTOMER chỉ xem đơn của chính mình
            if (isCust && currentCustomer != null) {
                predicates.add(cb.equal(root.get("customer").get("id"), currentCustomer.getId()));
            } else {
                // ADMIN / STAFF có thể lọc theo số điện thoại khách hàng
                if (customerPhone != null && !customerPhone.isBlank()) {
                    predicates.add(cb.like(root.join("customer").get("phoneNumber"), "%" + customerPhone.trim() + "%"));
                }
            }

            // 2. Lọc theo mã đơn hàng
            if (orderCode != null && !orderCode.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("orderCode")), "%" + orderCode.trim().toLowerCase() + "%"));
            }

            // 3. Lọc theo trạng thái
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            // 4. Lọc theo khoảng ngày đặt hàng
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("orderDate"), startDate.atStartOfDay()));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("orderDate"), endDate.atTime(LocalTime.MAX)));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Order> page = orderRepository.findAll(spec, pageable);

        List<OrderRes> content = page.getContent().stream().map(order -> {
            BigDecimal subTotal = order.getTotalAmount()
                    .subtract(order.getShippingFee() != null ? order.getShippingFee() : BigDecimal.ZERO)
                    .add(order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO);

            return OrderRes.builder()
                    .orderId(order.getId())
                    .orderCode(order.getOrderCode())
                    .status(order.getStatus())
                    .customerName(getCustomerFullName(order.getCustomer()))
                    .customerPhone(order.getCustomer() != null ? order.getCustomer().getPhoneNumber() : null)
                    .deliveryAddress(order.getDeliveryAddress())
                    .subTotal(subTotal)
                    .discountAmount(order.getDiscountAmount())
                    .shippingFee(order.getShippingFee())
                    .totalAmount(order.getTotalAmount())
                    .createdAt(order.getOrderDate())
                    .build();
        }).toList();

        return PageResponse.<OrderRes>builder()
                .content(content)
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .isLast(page.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDetailRes getOrderById(Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));

        // Kiểm tra quyền riêng tư dữ liệu: Khách hàng chỉ xem được đơn của mình
        if (isCustomer(auth)) {
            Customer currentCustomer = userRepository.findByAccount_Username(auth.getName())
                    .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
            if (order.getCustomer() == null || !order.getCustomer().getId().equals(currentCustomer.getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        return mapToOrderDetailRes(order);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDetailRes updateOrderStatus(Long id, OrderStatusUpdateReq req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));

        OrderStatus currentStatus = order.getStatus();
        OrderStatus targetStatus = req.getStatus();

        // 1. Kiểm tra trạng thái đóng & trạng thái tạm lưu POS
        if (currentStatus == OrderStatus.DRAFT) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Đơn hàng đang ở trạng thái tạm lưu (DRAFT). Vui lòng thực hiện thanh toán tại quầy POS để hoàn tất.");
        }
        if (currentStatus == OrderStatus.CANCELLED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã bị hủy, không thể thay đổi trạng thái");
        }
        if (currentStatus == OrderStatus.COMPLETED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã hoàn tất, không thể thay đổi trạng thái");
        }
        if (currentStatus == OrderStatus.RETURNED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã được trả lại, không thể thay đổi trạng thái");
        }

        // 2. Kiểm tra tính tuần tự: PENDING -> CONFIRMED -> PACKING -> SHIPPING -> COMPLETED
        boolean isValidTransition = switch (currentStatus) {
            case PENDING -> targetStatus == OrderStatus.CONFIRMED;
            case CONFIRMED -> targetStatus == OrderStatus.PACKING;
            case PACKING -> targetStatus == OrderStatus.SHIPPING;
            case SHIPPING -> targetStatus == OrderStatus.COMPLETED;
            default -> false;
        };

        if (!isValidTransition) {
            throw new AppException(ErrorCode.INVALID_REQUEST, String.format(
                    "Không thể chuyển trạng thái từ %s sang %s. Thứ tự tuần tự là: PENDING -> CONFIRMED -> PACKING -> SHIPPING -> COMPLETED",
                    currentStatus, targetStatus));
        }

        // 3. Gán nhân viên xử lý
        String username = auth.getName();
        employeeRepository.findByAccount_Username(username).ifPresent(order::setEmployee);

        // 4. Cập nhật ghi chú tiến trình nếu có
        if (req.getNote() != null && !req.getNote().isBlank()) {
            String currentNote = order.getNote();
            String noteLog = String.format("[%s]: %s", targetStatus, req.getNote().trim());
            String updatedNote = (currentNote != null && !currentNote.isBlank())
                    ? currentNote + " | " + noteLog
                    : noteLog;
            order.setNote(updatedNote);
        }

        // 5. Cập nhật tồn kho khi hoàn tất đơn hàng (COMPLETED)
        if (targetStatus == OrderStatus.COMPLETED) {
            for (OrderDetail detail : order.getDetails()) {
                ProductVariant variant = detail.getVariant();
                Inventory inventory = inventoryRepository.findByVariantId(variant.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.INVENTORY_NOT_FOUND));

                // Trừ tồn kho vật lý và giải phóng tồn tạm giữ
                inventory.setPhysicalStock(inventory.getPhysicalStock() - detail.getQuantity());
                inventory.setReservedStock(inventory.getReservedStock() - detail.getQuantity());
                inventoryRepository.save(inventory);
            }
        }

        order.setStatus(targetStatus);
        Order savedOrder = orderRepository.save(order);

        return mapToOrderDetailRes(savedOrder);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDetailRes cancelOrder(Long id, OrderCancelReq req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));

        OrderStatus currentStatus = order.getStatus();

        // 1. Kiểm tra trạng thái đóng
        if (currentStatus == OrderStatus.CANCELLED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã được hủy trước đó");
        }
        if (currentStatus == OrderStatus.COMPLETED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã hoàn tất, không thể hủy (chỉ có thể thực hiện đổi trả)");
        }
        if (currentStatus == OrderStatus.RETURNED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã hoàn trả, không thể hủy");
        }

        // 2. Phân quyền và điều kiện hủy theo vai trò
        boolean isCust = isCustomer(auth);
        String cancelActorLog;

        if (isCust) {
            Customer currentCustomer = userRepository.findByAccount_Username(auth.getName())
                    .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));

            if (order.getCustomer() == null || !order.getCustomer().getId().equals(currentCustomer.getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }

            // Khách hàng chỉ được tự hủy khi đơn ở trạng thái PENDING hoặc CONFIRMED
            if (currentStatus != OrderStatus.PENDING && currentStatus != OrderStatus.CONFIRMED) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Đơn hàng đang trong quá trình chuẩn bị hoặc giao hàng, khách hàng không thể tự hủy. Vui lòng liên hệ nhân viên để được hỗ trợ.");
            }

            cancelActorLog = "[HỦY ĐƠN - KHÁCH HÀNG]";
        } else {
            // ADMIN hoặc STAFF hủy đơn
            String username = auth.getName();
            employeeRepository.findByAccount_Username(username).ifPresent(order::setEmployee);
            cancelActorLog = String.format("[HỦY ĐƠN - NHÂN VIÊN %s]", username);
        }

        // 3. Hoàn trả tồn kho tạm giữ sang khả dụng (FR-40) nếu đơn không phải DRAFT
        if (currentStatus != OrderStatus.DRAFT) {
            for (OrderDetail detail : order.getDetails()) {
                ProductVariant variant = detail.getVariant();
                Inventory inventory = inventoryRepository.findByVariantId(variant.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.INVENTORY_NOT_FOUND));

                // Hoàn trả tồn khả dụng và giải phóng tồn tạm giữ
                inventory.setAvailableStock(inventory.getAvailableStock() + detail.getQuantity());
                inventory.setReservedStock(inventory.getReservedStock() - detail.getQuantity());
                inventoryRepository.save(inventory);
            }
        }

        // 4. Cập nhật ghi chú lý do hủy
        String reason = req.getReason() != null ? req.getReason().trim() : "Khách hàng yêu cầu hủy đơn";
        String noteLog = String.format("%s: %s", cancelActorLog, reason);
        String currentNote = order.getNote();
        String updatedNote = (currentNote != null && !currentNote.isBlank())
                ? currentNote + " | " + noteLog
                : noteLog;
        order.setNote(updatedNote);

        // 5. Cập nhật trạng thái CANCELLED
        order.setStatus(OrderStatus.CANCELLED);
        Order savedOrder = orderRepository.save(order);

        return mapToOrderDetailRes(savedOrder);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDetailRes createPosDraftOrder(PosDraftOrderReq req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        // 1. Lấy thông tin nhân viên thu ngân tạo đơn tạm
        String username = auth.getName();
        Employee employee = employeeRepository.findByAccount_Username(username).orElse(null);

        // 2. Tìm khách hàng theo số điện thoại (nếu có cung cấp)
        Customer customer = null;
        String note = req.getNote() != null ? req.getNote().trim() : "";
        if (req.getCustomerPhone() != null && !req.getCustomerPhone().isBlank()) {
            String phone = req.getCustomerPhone().trim();
            customer = userRepository.findByPhoneNumber(phone).orElse(null);
            if (customer == null) {
                note = (note.isBlank() ? "" : note + " | ") + "[SĐT khách: " + phone + "]";
            }
        }

        // 3. Xử lý các mặt hàng trong đơn tạm
        List<OrderDetail> orderDetails = new ArrayList<>();
        BigDecimal subTotal = BigDecimal.ZERO;

        for (PosDraftItemReq item : req.getItems()) {
            ProductVariant variant = productVariantRepository.findById(item.getSkuId())
                    .orElseThrow(() -> new AppException(ErrorCode.VARIANT_NOT_FOUND,
                            "Không tìm thấy biến thể SKU với ID: " + item.getSkuId()));

            Inventory inventory = inventoryRepository.findByVariantId(variant.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.INVENTORY_NOT_FOUND));

            if (inventory.getAvailableStock() < item.getQuantity()) {
                throw new AppException(ErrorCode.INSUFFICIENT_STOCK,
                        String.format("Sản phẩm SKU %s không đủ số lượng tồn khả dụng (còn: %d, yêu cầu: %d)",
                                variant.getId(), inventory.getAvailableStock(), item.getQuantity()));
            }

            // Tính đơn giá: basePrice + additionalPrice
            BigDecimal basePrice = variant.getProduct().getPrice();
            BigDecimal additionalPrice = variant.getAdditionalPrice() != null
                    ? variant.getAdditionalPrice()
                    : BigDecimal.ZERO;
            BigDecimal unitPrice = basePrice.add(additionalPrice);
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(item.getQuantity()));

            subTotal = subTotal.add(lineTotal);

            OrderDetail detail = OrderDetail.builder()
                    .id(new OrderDetailId(null, variant.getId()))
                    .variant(variant)
                    .quantity(item.getQuantity())
                    .unitPrice(unitPrice)
                    .build();
            orderDetails.add(detail);
        }

        // 4. Sinh mã đơn tạm POS-YYYYMMDD-XXX
        String orderCode = generatePosOrderCode();

        // 5. Khởi tạo đơn hàng trạng thái DRAFT
        Order order = Order.builder()
                .orderCode(orderCode)
                .customer(customer)
                .employee(employee)
                .status(OrderStatus.DRAFT)
                .deliveryAddress("Bán tại quầy (POS)")
                .shippingFee(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(subTotal)
                .note(note)
                .build();

        for (OrderDetail detail : orderDetails) {
            detail.setOrder(order);
        }
        order.setDetails(orderDetails);

        Order savedOrder = orderRepository.save(order);
        return mapToOrderDetailRes(savedOrder);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDetailRes> getPosDraftOrders() {
        List<Order> drafts = orderRepository.findByStatusOrderByOrderDateDesc(OrderStatus.DRAFT);
        return drafts.stream()
                .map(this::mapToOrderDetailRes)
                .toList();
    }

    @Override
    public ShippingFeeRes calculateShippingFee(ShippingFeeCalcReq req) {
        String province = req.getProvince() != null ? req.getProvince().trim().toLowerCase() : "";
        int weight = req.getTotalWeightGram() != null ? req.getTotalWeightGram() : 0;

        int baseFee;
        String estimatedDays;

        // 1. Phân loại vùng giao hàng (Nội tỉnh TP.HCM vs Liên tỉnh)
        if (province.contains("hồ chí minh") || province.contains("ho chi minh") || province.contains("hcm")) {
            baseFee = 25000;
            estimatedDays = "1 - 2 ngày";
        } else if (province.contains("hà nội") || province.contains("ha noi")
                || province.contains("đà nẵng") || province.contains("da nang")
                || province.contains("bình dương") || province.contains("binh duong")
                || province.contains("đồng nai") || province.contains("dong nai")) {
            baseFee = 30000;
            estimatedDays = "2 - 3 ngày";
        } else {
            baseFee = 35000;
            estimatedDays = "3 - 5 ngày";
        }

        // 2. Phụ phí vượt cân nặng (Base cước áp dụng tối đa 2000g, mỗi 500g vượt +5.000 VNĐ)
        int extraFee = 0;
        if (weight > 2000) {
            int extraGrams = weight - 2000;
            int extraSteps = (int) Math.ceil((double) extraGrams / 500.0);
            extraFee = extraSteps * 5000;
        }

        BigDecimal totalShippingFee = BigDecimal.valueOf(baseFee + extraFee).setScale(2);

        return ShippingFeeRes.builder()
                .shippingFee(totalShippingFee)
                .estimatedDays(estimatedDays)
                .build();
    }
}
