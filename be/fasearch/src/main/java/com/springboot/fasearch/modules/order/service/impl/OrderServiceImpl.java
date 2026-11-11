package com.springboot.fasearch.modules.order.service.impl;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.common.search.SearchTextNormalizer;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CartQuoteRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CartQuoteResponse;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService.Application;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
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
import com.springboot.fasearch.modules.order.entity.CheckoutIdempotency;
import com.springboot.fasearch.modules.order.entity.CheckoutIdempotencyId;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.entity.OrderDetailId;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
import com.springboot.fasearch.modules.order.repository.CheckoutIdempotencyRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.repository.OrderSpecifications;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.service.impl.CancelledOrderStripeExpiry;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.order.service.interfaces.OrderService;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.Employee;
import com.springboot.fasearch.modules.user.repository.EmployeeRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final InvoiceRepository invoiceRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final InventoryRepository inventoryRepository;
    private final ProductVariantRepository productVariantRepository;
    private final CheckoutBenefitService checkoutBenefitService;
    private final com.springboot.fasearch.modules.order.service.interfaces.ShippingService shippingService;
    private final LoyaltyService loyaltyService;
    private final CheckoutIdempotencyRepository checkoutIdempotencyRepository;
    private final CancelledOrderStripeExpiry cancelledOrderStripeExpiry;
    private final OrderItemHistoryBuilder orderItemHistoryBuilder;
    private final org.springframework.context.ApplicationEventPublisher notificationEvents;

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
        // Names come from the native history snapshot, never from variant/product proxies:
        // a legacy soft-deleted SKU must not break an old order document.
        List<OrderItemRes> items = orderItemHistoryBuilder.build(order.getDetails());
        BigDecimal calculatedSubTotal = BigDecimal.ZERO;
        for (OrderDetail detail : order.getDetails()) {
            BigDecimal unitPrice = detail.getUnitPrice() == null ? BigDecimal.ZERO : detail.getUnitPrice();
            int quantity = detail.getQuantity() == null ? 0 : detail.getQuantity();
            calculatedSubTotal = calculatedSubTotal.add(unitPrice.multiply(BigDecimal.valueOf(quantity)));
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
                .deliveryLatitude(order.getDeliveryLatitude()).deliveryLongitude(order.getDeliveryLongitude())
                .distanceKm(order.getDistanceKm()).shippingMethod(order.getShippingMethod())
                .note(order.getNote())
                .items(items)
                .subTotal(calculatedSubTotal)
                .discountAmount(order.getDiscountAmount())
                .redeemedPoints(order.getRedeemedPoints())
                .pointsDiscount(order.getPointsDiscount())
                .loyaltyPolicyId(order.getLoyaltyPolicyId())
                .loyaltyPolicyVersion(order.getLoyaltyPolicyVersion())
                .redeemCurrencyPerPointSnapshot(order.getRedeemCurrencyPerPointSnapshot())
                .earnedPoints(order.getEarnedPoints())
                .voucherId(order.getVoucherId())
                .voucherCode(order.getVoucherCode())
                .voucherCampaignName(order.getVoucherCampaignName())
                .voucherCampaignVersion(order.getVoucherCampaignVersion())
                .shippingFee(order.getShippingFee())
                .totalAmount(orderTotalAmount(order))
                .createdAt(order.getOrderDate())
                .build();
    }

    private void fillPaidPayment(Order order, OrderDetailRes res) {
        if (order == null || res == null) {
            return;
        }
        invoiceRepository.findByOrderId(order.getId()).ifPresent(invoice -> {
            if (invoice.getStatus() == PaymentStatus.PAID || invoice.getStatus() == PaymentStatus.REFUNDED) {
                res.setPaymentStatus(invoice.getStatus());
                res.setPaymentMethod(invoice.getPaymentMethodCode());
                res.setPaidAmount(invoice.getTotalActualPaid());
                var refunds=invoiceRepository.refundedByOrderIds(java.util.List.of(order.getId()));
                res.setRefundedAmount(refunds.isEmpty()?BigDecimal.ZERO:(BigDecimal)refunds.getFirst()[1]);
            }
        });
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderRes checkout(CheckoutReq req) {
        Customer customer = getCurrentCustomer();

        Cart cart = cartRepository.findByCustomerIdForUpdate(customer.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CART_EMPTY));
        String checkoutKey = req.getCheckoutKey() == null ? null : req.getCheckoutKey().strip();
        int redeemedPoints = LoyaltyService.parsePoints(req.getRedeemedPoints());
        if (checkoutKey != null && (checkoutKey.isBlank() || checkoutKey.length() > 100)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "checkoutKey phải có từ 1 đến 100 ký tự.");
        }
        if (((req.getVoucherCode() != null && !req.getVoucherCode().isBlank()) || redeemedPoints > 0) && checkoutKey == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cần checkoutKey cho ưu đãi khi thanh toán.");
        }
        String payloadHash = checkoutKey == null ? null : checkoutPayloadHash(req);
        if (checkoutKey != null) {
            CheckoutIdempotency prior = checkoutIdempotencyRepository.findById(
                    new CheckoutIdempotencyId(customer.getId(), checkoutKey)).orElse(null);
            if (prior != null) {
                if (!prior.getPayloadHash().equals(payloadHash)) throw new AppException(ErrorCode.IDEMPOTENCY_CONFLICT);
                Order replay = orderRepository.findById(prior.getOrderId())
                        .orElseThrow(() -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR));
                return toOrderRes(replay, true);
            }
        }

        List<CartItem> cartItems = cartItemRepository.findById_CartId(cart.getId());
        cartItems.sort(java.util.Comparator.comparing(item -> item.getVariant().getId()));
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
            BigDecimal additionalPrice = variant.getAdditionalPrice() == null
                    ? BigDecimal.ZERO : variant.getAdditionalPrice();
            BigDecimal unitPrice = variant.getProduct().getPrice().add(additionalPrice);
            subTotal = subTotal.add(unitPrice.multiply(BigDecimal.valueOf(item.getQuantity())));
            orderDetails.add(OrderDetail.builder().id(new OrderDetailId(null, variant.getId()))
                    .variant(variant).quantity(item.getQuantity()).unitPrice(unitPrice).build());
        }

        // 4. Revalidate quote and hold voucher quota in this order transaction.
        Application benefit = checkoutBenefitService.prepareCheckout(orderDetails, customer.getId(), req.getVoucherCode(),
                redeemedPoints, req.getQuoteFingerprint(), req.getExpectedMerchandiseAmountDue());
        for (OrderDetail detail : orderDetails) {
            detail.setDiscountAmount(benefit.discountBySku().getOrDefault(
                    detail.getVariant().getId(), BigDecimal.ZERO.setScale(2)));
            detail.setPointsDiscountAmount(benefit.loyaltyQuote().pointsDiscountBySku().getOrDefault(
                    detail.getVariant().getId(), BigDecimal.ZERO.setScale(2)));
        }
        // Lock voucher/customer before sorted SKU rows to keep checkout and release lock order consistent.
        for (CartItem item : cartItems) {
            Inventory inventory = inventoryRepository.findByVariantIdForUpdate(item.getVariant().getId())
                    .orElseThrow(() -> new AppException(ErrorCode.INSUFFICIENT_STOCK));
            if (inventory.getAvailableStock() < item.getQuantity()) throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
            inventory.setAvailableStock(inventory.getAvailableStock() - item.getQuantity());
            inventory.setReservedStock(inventory.getReservedStock() + item.getQuantity());
            inventoryRepository.save(inventory);
        }
        com.springboot.fasearch.modules.order.service.impl.ShippingServiceImpl.validateCoordinates(req.getDeliveryLatitude(), req.getDeliveryLongitude());
        ShippingFeeRes deliveryQuote = req.getDeliveryLatitude() == null ? null
                : shippingService.quote(req.getDeliveryLatitude(), req.getDeliveryLongitude());
        BigDecimal shippingFee = deliveryQuote == null
                ? (req.getShippingFee() != null ? req.getShippingFee() : BigDecimal.ZERO) : deliveryQuote.getShippingFee();
        if (benefit.campaign() != null && "FREE_SHIP".equals(benefit.campaign().getDiscountType())) shippingFee = BigDecimal.ZERO;
        if (deliveryQuote != null && req.getShippingFee() != null && req.getShippingFee().compareTo(shippingFee) != 0)
            throw new AppException(ErrorCode.QUOTE_CHANGED, "Phí vận chuyển đã thay đổi; hãy yêu cầu báo giá mới.");
        BigDecimal discountAmount = benefit.discount();
        BigDecimal totalAmount = subTotal.subtract(discountAmount).subtract(benefit.loyaltyQuote().pointsDiscount())
                .add(shippingFee).setScale(2, java.math.RoundingMode.HALF_UP);

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
        order.setDeliveryLatitude(req.getDeliveryLatitude());
        order.setDeliveryLongitude(req.getDeliveryLongitude());
        order.setDistanceKm(deliveryQuote == null ? null : deliveryQuote.getDistanceKm());
        order.setShippingMethod(deliveryQuote == null ? "flat" : deliveryQuote.getMethod());
        checkoutBenefitService.applySnapshot(order, benefit);

        for (OrderDetail detail : orderDetails) {
            detail.setOrder(order);
        }
        order.setDetails(orderDetails);

        Order savedOrder = orderRepository.save(order);
        notificationEvents.publishEvent(new com.springboot.fasearch.modules.notification.NotificationEvents.OrderChanged(savedOrder.getId(), savedOrder.getStatus().name()));
        checkoutBenefitService.recordHold(savedOrder.getId(), benefit);
        if (checkoutKey != null) checkoutIdempotencyRepository.save(CheckoutIdempotency.builder()
                .id(new CheckoutIdempotencyId(customer.getId(), checkoutKey)).payloadHash(payloadHash)
                .orderId(savedOrder.getId()).createdAt(java.time.LocalDateTime.now()).build());

        // 6. Remove only the purchased snapshot; cart row lock serializes concurrent cart changes.
        for (CartItem item : cartItems) {
            cartItemRepository.deleteSnapshotLine(cart.getId(), item.getVariant().getId(), item.getQuantity());
        }
        int remainingItems = cartItemRepository.findById_CartId(cart.getId()).stream()
                .mapToInt(CartItem::getQuantity).sum();
        cart.setTotalItems(remainingItems);
        cartRepository.save(cart);

        return OrderRes.builder()
                .orderId(savedOrder.getId())
                .orderCode(savedOrder.getOrderCode())
                .status(savedOrder.getStatus())
                .customerName(getCustomerFullName(customer))
                .customerPhone(customer.getPhoneNumber())
                .deliveryAddress(savedOrder.getDeliveryAddress())
                .deliveryLatitude(savedOrder.getDeliveryLatitude()).deliveryLongitude(savedOrder.getDeliveryLongitude())
                .distanceKm(savedOrder.getDistanceKm()).shippingMethod(savedOrder.getShippingMethod())
                .subTotal(subTotal)
                .discountAmount(savedOrder.getDiscountAmount())
                .redeemedPoints(savedOrder.getRedeemedPoints())
                .pointsDiscount(savedOrder.getPointsDiscount())
                .loyaltyPolicyId(savedOrder.getLoyaltyPolicyId())
                .loyaltyPolicyVersion(savedOrder.getLoyaltyPolicyVersion())
                .redeemCurrencyPerPointSnapshot(savedOrder.getRedeemCurrencyPerPointSnapshot())
                .earnedPoints(savedOrder.getEarnedPoints())
                .voucherId(savedOrder.getVoucherId())
                .voucherCode(savedOrder.getVoucherCode())
                .voucherCampaignName(savedOrder.getVoucherCampaignName())
                .voucherCampaignVersion(savedOrder.getVoucherCampaignVersion())
                .shippingFee(savedOrder.getShippingFee())
                .totalAmount(savedOrder.getTotalAmount())
                .createdAt(savedOrder.getOrderDate())
                .replayed(false)
                .build();
    }

    private BigDecimal orderTotalAmount(Order order) {
        if (order.getTotalAmount() == null) {
            log.warn("Order totalAmount is null, returning ZERO for orderId={}", order.getId());
            return BigDecimal.ZERO;
        }
        return order.getTotalAmount();
    }

    private BigDecimal orderSubTotal(Order order) {
        if (order.getTotalAmount() == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal shipping = order.getShippingFee() == null ? BigDecimal.ZERO : order.getShippingFee();
        BigDecimal discount = order.getDiscountAmount() == null ? BigDecimal.ZERO : order.getDiscountAmount();
        BigDecimal points = order.getPointsDiscount() == null ? BigDecimal.ZERO : order.getPointsDiscount();
        return order.getTotalAmount().subtract(shipping).add(discount).add(points);
    }

    private OrderRes toOrderRes(Order order, boolean replayed) {
        BigDecimal shipping = order.getShippingFee() == null ? BigDecimal.ZERO : order.getShippingFee();
        BigDecimal discount = order.getDiscountAmount() == null ? BigDecimal.ZERO : order.getDiscountAmount();
        return OrderRes.builder().orderId(order.getId()).orderCode(order.getOrderCode()).status(order.getStatus())
                .customerName(getCustomerFullName(order.getCustomer()))
                .customerPhone(order.getCustomer() == null ? null : order.getCustomer().getPhoneNumber())
                .deliveryAddress(order.getDeliveryAddress())
                .deliveryLatitude(order.getDeliveryLatitude()).deliveryLongitude(order.getDeliveryLongitude())
                .distanceKm(order.getDistanceKm()).shippingMethod(order.getShippingMethod())
                .subTotal(orderSubTotal(order))
                .discountAmount(discount).redeemedPoints(order.getRedeemedPoints())
                .pointsDiscount(order.getPointsDiscount()).loyaltyPolicyId(order.getLoyaltyPolicyId())
                .loyaltyPolicyVersion(order.getLoyaltyPolicyVersion())
                .redeemCurrencyPerPointSnapshot(order.getRedeemCurrencyPerPointSnapshot())
                .earnedPoints(order.getEarnedPoints()).voucherId(order.getVoucherId()).voucherCode(order.getVoucherCode())
                .voucherCampaignName(order.getVoucherCampaignName())
                .voucherCampaignVersion(order.getVoucherCampaignVersion()).shippingFee(shipping)
                .totalAmount(orderTotalAmount(order)).createdAt(order.getOrderDate()).replayed(replayed).build();
    }

    private String checkoutPayloadHash(CheckoutReq request) {
        String[] fields = {
                clean(request.getDeliveryAddress()), clean(request.getReceiverName()), clean(request.getReceiverPhone()),
                request.getVoucherCode() == null ? "" : request.getVoucherCode().strip().toUpperCase(Locale.ROOT),
                clean(request.getQuoteFingerprint()), moneyText(request.getExpectedMerchandiseAmountDue()),
                moneyText(request.getRedeemedPoints()), clean(request.getPaymentMethod()),
                moneyText(request.getShippingFee()), clean(request.getNote()),
                String.valueOf(request.getDeliveryLatitude()), String.valueOf(request.getDeliveryLongitude())
        };
        StringBuilder canonical = new StringBuilder("checkout-v1|");
        for (String field : fields) canonical.append(field.length()).append(':').append(field);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static String clean(String value) { return value == null ? "" : value.strip(); }
    private static String moneyText(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<OrderRes> getOrders(
            Pageable pageable,
            OrderStatus status,
            String orderCode,
            String customerPhone,
            LocalDate startDate,
            LocalDate endDate,
            String keyword) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        boolean isCust = isCustomer(auth);
        Customer currentCustomer = isCust
                ? userRepository.findByAccount_Username(auth.getName())
                        .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND))
                : null;

        Long customerId = isCust && currentCustomer != null ? currentCustomer.getId() : null;
        Specification<Order> spec = OrderSpecifications.list(customerId, status, orderCode, customerPhone,
                startDate, endDate, keyword);

        Page<Order> page = orderRepository.findAll(spec, pageable);

        // ONE batched invoice lookup for the page (no N+1). Additive only: payment fields stay null when no PAID invoice.
        java.util.Map<Long, Invoice> paidByOrder = new java.util.HashMap<>();
        if (!page.getContent().isEmpty()) {
            java.util.List<Long> orderIds = page.getContent().stream().map(Order::getId).toList();
            for (Invoice invoice : invoiceRepository.findByOrderIds(orderIds)) {
                if ((invoice.getStatus() == PaymentStatus.PAID || invoice.getStatus() == PaymentStatus.REFUNDED) && invoice.getOrder() != null) {
                    paidByOrder.put(invoice.getOrder().getId(), invoice);
                }
            }
        }

        List<OrderRes> content = page.getContent().stream().map(order -> {
            BigDecimal subTotal = orderSubTotal(order);
            Invoice paid = paidByOrder.get(order.getId());

            return OrderRes.builder()
                    .orderId(order.getId())
                    .orderCode(order.getOrderCode())
                    .status(order.getStatus())
                    .customerName(getCustomerFullName(order.getCustomer()))
                    .customerPhone(order.getCustomer() != null ? order.getCustomer().getPhoneNumber() : null)
                    .deliveryAddress(order.getDeliveryAddress())
                .deliveryLatitude(order.getDeliveryLatitude()).deliveryLongitude(order.getDeliveryLongitude())
                .distanceKm(order.getDistanceKm()).shippingMethod(order.getShippingMethod())
                    .subTotal(subTotal)
                    .discountAmount(order.getDiscountAmount())
                    .redeemedPoints(order.getRedeemedPoints())
                    .pointsDiscount(order.getPointsDiscount())
                    .loyaltyPolicyId(order.getLoyaltyPolicyId())
                    .loyaltyPolicyVersion(order.getLoyaltyPolicyVersion())
                    .redeemCurrencyPerPointSnapshot(order.getRedeemCurrencyPerPointSnapshot())
                    .earnedPoints(order.getEarnedPoints())
                    .voucherId(order.getVoucherId())
                    .voucherCode(order.getVoucherCode())
                    .voucherCampaignName(order.getVoucherCampaignName())
                    .voucherCampaignVersion(order.getVoucherCampaignVersion())
                    .shippingFee(order.getShippingFee())
                    .totalAmount(orderTotalAmount(order))
                    .paymentStatus(paid == null ? null : paid.getStatus())
                    .paymentMethod(paid == null ? null : paid.getPaymentMethodCode())
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

        OrderDetailRes res = mapToOrderDetailRes(order);
        fillPaidPayment(order, res);
        return res;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDetailRes updateOrderStatus(Long id, OrderStatusUpdateReq req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Order order = orderRepository.findByIdForUpdate(id)
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

        // 5. COD benefit holds must settle on an actual invoice before completion.
        if (targetStatus == OrderStatus.COMPLETED) {
            if (order.getLoyaltyQuoteFingerprint() != null
                    && !invoiceRepository.existsByOrderIdAndStatus(order.getId(), PaymentStatus.PAID)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn S2 phải được thu qua hóa đơn trước khi hoàn tất.");
            }
            checkoutBenefitService.requireConsumed(order.getId());
            loyaltyService.requireConsumed(order);
        }

        // 6. Cập nhật tồn kho khi hoàn tất đơn hàng (COMPLETED)
        if (targetStatus == OrderStatus.COMPLETED) {
            for (OrderDetail detail : order.getDetails()) {
                ProductVariant variant = detail.getVariant();
                Inventory inventory = inventoryRepository.findByVariantIdForUpdate(variant.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.INVENTORY_NOT_FOUND));

                // Trừ tồn kho vật lý và giải phóng tồn tạm giữ
                inventory.setPhysicalStock(inventory.getPhysicalStock() - detail.getQuantity());
                inventory.setReservedStock(inventory.getReservedStock() - detail.getQuantity());
                inventoryRepository.save(inventory);
            }
        }

        order.setStatus(targetStatus);
        Order savedOrder = orderRepository.save(order);
        notificationEvents.publishEvent(new com.springboot.fasearch.modules.notification.NotificationEvents.OrderChanged(savedOrder.getId(), targetStatus.name()));

        OrderDetailRes detailRes = mapToOrderDetailRes(savedOrder);
        fillPaidPayment(savedOrder, detailRes);
        return detailRes;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDetailRes cancelOrder(Long id, OrderCancelReq req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Order order = orderRepository.findByIdForUpdate(id)
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
        if (invoiceRepository.existsByOrderIdAndStatus(id, PaymentStatus.PAID)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn đã thu tiền không thể hủy hoặc đưa về trạng thái chưa thu.");
        }
        if (currentStatus == OrderStatus.SHIPPING
                && (order.getVoucherCode() != null || (order.getRedeemedPoints() != null && order.getRedeemedPoints() > 0))) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Các khoản giữ tài chính S2 vẫn được cam kết sau khi bàn giao.");
        }

        // 2. Chỉ giải phóng giữ hàng/ưu đãi trước khi bàn giao vận chuyển.
        if (order.getVoucherCode() != null && currentStatus != OrderStatus.DRAFT
                && currentStatus != OrderStatus.PENDING && currentStatus != OrderStatus.CONFIRMED
                && currentStatus != OrderStatus.PACKING) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn có Voucher không thể hủy sau khi bàn giao.");
        }

        // 3. Phân quyền và điều kiện hủy theo vai trò
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

        // Release financial holds before locking sorted SKU rows; all transitions use benefit/customer/SKU order.
        checkoutBenefitService.release(order.getId());
        loyaltyService.releaseOrderHold(order.getId());

        // 3. Hoàn trả tồn kho tạm giữ sang khả dụng (FR-40) nếu đơn không phải DRAFT
        if (currentStatus != OrderStatus.DRAFT) {
            for (OrderDetail detail : order.getDetails().stream()
                    .sorted(java.util.Comparator.comparing(row -> row.getVariant().getId())).toList()) {
                ProductVariant variant = detail.getVariant();
                Inventory inventory = inventoryRepository.findByVariantIdForUpdate(variant.getId())
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
        order.setCancellationReason(reason);

        // 5. Cập nhật trạng thái CANCELLED
        order.setStatus(OrderStatus.CANCELLED);
        Order savedOrder = orderRepository.save(order);
        notificationEvents.publishEvent(new com.springboot.fasearch.modules.notification.NotificationEvents.OrderChanged(savedOrder.getId(), "CANCELLED"));

        // Expire open Stripe sessions AFTER the order transaction commits, so a Stripe failure
        // cannot roll back the cancellation and no HTTP call holds a DB transaction open.
        // VNPay has no equivalent and is left untouched. Already-settled attempts are left for REVIEW.
        final Long cancelledOrderId = savedOrder.getId();
        if (cancelledOrderStripeExpiry != null) {
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        cancelledOrderStripeExpiry.expireAfterCommit(cancelledOrderId);
                    }
                });
            } else {
                cancelledOrderStripeExpiry.expireAfterCommit(cancelledOrderId);
            }
        }

        OrderDetailRes cancelledRes = mapToOrderDetailRes(savedOrder);
        fillPaidPayment(savedOrder, cancelledRes);
        return cancelledRes;
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
    public CartQuoteResponse quotePosOrder(Long orderId, CartQuoteRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) throw new AppException(ErrorCode.UNAUTHENTICATED);
        if (!auth.getAuthorities().stream().anyMatch(authority ->
                authority.getAuthority().equals("ROLE_ADMIN") || authority.getAuthority().equals("ROLE_STAFF"))) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        Order order = orderRepository.findById(orderId).orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (order.getStatus() != OrderStatus.DRAFT) throw new AppException(ErrorCode.QUOTE_CHANGED);
        int redeemedPoints = LoyaltyService.parsePoints(req.getRedeemedPoints());
        Long customerId = order.getCustomer() == null ? null : order.getCustomer().getId();
        return checkoutBenefitService.quoteOrder(order.getDetails(), order.getId(), customerId,
                req.getVoucherCode(), redeemedPoints);
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
        com.springboot.fasearch.modules.order.service.impl.ShippingServiceImpl.validateCoordinates(req.getDeliveryLatitude(), req.getDeliveryLongitude());
        if (req.getDeliveryLatitude() != null) return shippingService.quote(req.getDeliveryLatitude(), req.getDeliveryLongitude());
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
                .method("flat").baseFee(totalShippingFee).shippingDiscount(BigDecimal.ZERO)
                .shippingFee(totalShippingFee)
                .estimatedDays(estimatedDays)
                .build();
    }
}
