package com.springboot.fasearch.modules.payment.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService.Application;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.dto.request.PaymentCalculateReq;
import com.springboot.fasearch.modules.payment.dto.request.PaymentProcessReq;
import com.springboot.fasearch.modules.payment.dto.response.InvoiceRes;
import com.springboot.fasearch.modules.payment.dto.response.PaymentCalculationRes;
import com.springboot.fasearch.modules.payment.dto.response.PaymentMethodRes;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.payment.entity.Payment;
import com.springboot.fasearch.modules.payment.entity.PaymentMethod;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentMethodRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentRepository;
import com.springboot.fasearch.modules.payment.service.interfaces.PaymentService;
import com.springboot.fasearch.modules.payment.service.interfaces.PaymentService.PaymentResult;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.Employee;
import com.springboot.fasearch.modules.user.repository.EmployeeRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PaymentMethodRepository paymentMethodRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final InventoryRepository inventoryRepository;
    private final CheckoutBenefitService checkoutBenefitService;
    private final LoyaltyService loyaltyService;

    @Override
    @Transactional(readOnly = true)
    public PaymentCalculationRes calculatePayment(PaymentCalculateReq req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        // 1. Kiểm tra đơn hàng tồn tại
        Order order = orderRepository.findById(req.getOrderId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));

        // 2. Chặn đơn ở trạng thái kết thúc không thể thanh toán
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã bị hủy, không thể tính toán thanh toán");
        }
        if (order.getStatus() == OrderStatus.RETURNED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã được hoàn trả, không thể tính toán thanh toán");
        }

        // 3. Phân quyền: Khách hàng chỉ được tính toán cho đơn của chính mình
        boolean isCustomer = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + RoleType.CUSTOMER.name()));

        if (isCustomer) {
            Customer currentCustomer = userRepository.findByAccount_Username(auth.getName())
                    .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
            if (order.getCustomer() == null || !order.getCustomer().getId().equals(currentCustomer.getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        // 4. Tính tổng tiền hàng (subTotal)
        BigDecimal subTotal = BigDecimal.ZERO;
        if (order.getDetails() != null) {
            for (OrderDetail detail : order.getDetails()) {
                BigDecimal lineTotal = detail.getUnitPrice().multiply(BigDecimal.valueOf(detail.getQuantity()));
                subTotal = subTotal.add(lineTotal);
            }
        }

        BigDecimal voucherDiscount = order.getDiscountAmount() == null ? BigDecimal.ZERO : order.getDiscountAmount();
        int requestedPoints = LoyaltyService.parsePoints(req.getRedeemedPoints());
        if (req.getVoucherCode() != null && !req.getVoucherCode().isBlank()
                && !req.getVoucherCode().trim().equalsIgnoreCase(order.getVoucherCode())) {
            throw new AppException(order.getLoyaltyQuoteFingerprint() == null ? ErrorCode.INVALID_REQUEST : ErrorCode.QUOTE_CHANGED,
                    "Voucher must match the persisted order snapshot");
        }

        BigDecimal pointDiscount;
        if (order.getLoyaltyQuoteFingerprint() != null) {
            if (req.getRedeemedPoints() != null && requestedPoints != (order.getRedeemedPoints() == null ? 0 : order.getRedeemedPoints())) {
                throw new AppException(ErrorCode.QUOTE_CHANGED);
            }
            pointDiscount = order.getPointsDiscount() == null ? BigDecimal.ZERO : order.getPointsDiscount();
        } else if (order.getVoucherCode() != null) {
            if (requestedPoints > 0) throw new AppException(ErrorCode.INVALID_REQUEST, "Legacy voucher orders cannot add request-only points");
            pointDiscount = BigDecimal.ZERO;
        } else {
            // Pre-S2 non-voucher calculation remains a display-only legacy preview.
            pointDiscount = BigDecimal.ZERO;
            if (requestedPoints > 0) {
                if (order.getCustomer() == null) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Guest orders cannot use loyalty points");
                }
                int availablePoints = order.getCustomer().getAccumulatePoint() == null
                        ? 0 : order.getCustomer().getAccumulatePoint();
                if (requestedPoints > availablePoints) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Requested points exceed legacy balance");
                }
                pointDiscount = BigDecimal.valueOf(requestedPoints).multiply(BigDecimal.valueOf(1000))
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal remaining = subTotal.subtract(voucherDiscount);
                if (remaining.signum() > 0 && pointDiscount.compareTo(remaining) > 0) pointDiscount = remaining;
            }
        }

        // 7. Lấy phí vận chuyển
        BigDecimal shippingFee = order.getShippingFee() != null ? order.getShippingFee() : BigDecimal.ZERO;

        // 8. Tính tổng tiền thực trả (finalAmount)
        BigDecimal netProductAmount = subTotal.subtract(voucherDiscount).subtract(pointDiscount);
        if (netProductAmount.compareTo(BigDecimal.ZERO) < 0) {
            netProductAmount = BigDecimal.ZERO;
        }
        BigDecimal finalAmount = netProductAmount.add(shippingFee).setScale(2, RoundingMode.HALF_UP);

        // 9. Thuế VAT 8% tính trên tổng tiền thực trả
        BigDecimal taxVat = finalAmount.multiply(BigDecimal.valueOf(0.08)).setScale(2, RoundingMode.HALF_UP);

        return PaymentCalculationRes.builder()
                .subTotal(subTotal.setScale(2, RoundingMode.HALF_UP))
                .redeemedPoints(order.getLoyaltyQuoteFingerprint() != null
                        ? (order.getRedeemedPoints() == null ? 0 : order.getRedeemedPoints())
                        : (order.getVoucherCode() == null ? requestedPoints : 0))
                .voucherDiscount(voucherDiscount.setScale(2, RoundingMode.HALF_UP))
                .pointDiscount(pointDiscount.setScale(2, RoundingMode.HALF_UP))
                .shippingFee(shippingFee.setScale(2, RoundingMode.HALF_UP))
                .taxVat(taxVat)
                .finalAmount(finalAmount)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentMethodRes> getPaymentMethods() {
        return paymentMethodRepository.findByStatus("ACTIVE").stream()
                .map(method -> PaymentMethodRes.builder()
                        .id(method.getId())
                        .methodCode(method.getType())
                        .methodName(method.getName())
                        .status(method.getStatus())
                        .note(method.getNote())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PaymentResult processPayment(PaymentProcessReq req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        // 1. Lock order so duplicate collection attempts observe the first invoice.
        Order order = orderRepository.findByIdForUpdate(req.getOrderId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));

        // 2. Chặn đơn hàng ở trạng thái kết thúc không thể thanh toán
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã bị hủy, không thể thanh toán");
        }
        if (order.getStatus() == OrderStatus.RETURNED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng đã được hoàn trả, không thể thanh toán");
        }

        boolean posDraft = order.getStatus() == OrderStatus.DRAFT;
        boolean posOrder = order.getOrderCode() != null && order.getOrderCode().startsWith("POS-");
        int requestedPoints = LoyaltyService.parsePoints(req.getRedeemedPoints());
        Invoice previousInvoice = invoiceRepository.findByOrderId(order.getId()).orElse(null);

        // 4. Phân quyền: Khách hàng chỉ được thanh toán cho đơn của chính mình
        boolean isCustomer = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + RoleType.CUSTOMER.name()));

        if (isCustomer) {
            Customer currentCustomer = userRepository.findByAccount_Username(auth.getName())
                    .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
            if (order.getCustomer() == null || !order.getCustomer().getId().equals(currentCustomer.getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        // 5. Xác định nhân viên thu ngân (nếu là ADMIN hoặc STAFF tạo/thanh toán hóa đơn)
        Employee employee = null;
        if (!isCustomer) {
            employee = employeeRepository.findByAccount_Username(auth.getName()).orElse(null);
        }

        if (posOrder && isCustomer) throw new AppException(ErrorCode.FORBIDDEN);
        boolean hasBenefitInput = (req.getVoucherCode() != null && !req.getVoucherCode().isBlank())
                || requestedPoints > 0 || (req.getQuoteFingerprint() != null && !req.getQuoteFingerprint().isBlank());
        if (!posOrder && hasBenefitInput) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "POS benefit fields are only accepted for POS orders");
        }
        if (previousInvoice != null) {
            if (posOrder && previousInvoice.getStatus() == PaymentStatus.PAID
                    && order.getLoyaltyQuoteFingerprint() != null) {
                if (!matchesPosReplay(req, order, previousInvoice, requestedPoints)) {
                    throw new AppException(ErrorCode.IDEMPOTENCY_CONFLICT);
                }
                return new PaymentResult(invoiceResponse(previousInvoice, order), true);
            }
            throw new AppException(ErrorCode.ORDER_ALREADY_PAID);
        }

        // 6. Kiểm tra phương thức thanh toán
        PaymentMethod paymentMethod = paymentMethodRepository.findByTypeAndStatus(req.getPaymentMethodCode(), "ACTIVE")
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_METHOD_NOT_FOUND));
        if (paymentMethod.getType() != PaymentMethodType.CASH) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Non-cash payments must use the provider checkout flow");
        }
        if (posDraft && paymentMethod.getType() != PaymentMethodType.CASH) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "POS draft orders must be settled in cash");
        }
        if (order.getVoucherCode() != null && isCustomer) throw new AppException(ErrorCode.FORBIDDEN);
        if (!posDraft && order.getVoucherCode() != null && (order.getStatus() != OrderStatus.SHIPPING
                || paymentMethod.getType() != PaymentMethodType.CASH)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Voucher COD orders can only be collected in cash by staff after handoff");
        }

        if (posDraft) {
            Application benefit = checkoutBenefitService.preparePosPayment(order.getDetails(),
                    order.getCustomer() == null ? null : order.getCustomer().getId(), req.getVoucherCode(),
                    requestedPoints, req.getQuoteFingerprint());
            BigDecimal subtotal = BigDecimal.ZERO;
            for (OrderDetail detail : order.getDetails()) {
                BigDecimal lineTotal = detail.getUnitPrice().multiply(BigDecimal.valueOf(detail.getQuantity()));
                subtotal = subtotal.add(lineTotal);
                detail.setDiscountAmount(benefit.discountBySku().getOrDefault(
                        detail.getVariant().getId(), BigDecimal.ZERO.setScale(2)));
                detail.setPointsDiscountAmount(benefit.loyaltyQuote().pointsDiscountBySku().getOrDefault(
                        detail.getVariant().getId(), BigDecimal.ZERO.setScale(2)));
            }
            order.setDiscountAmount(benefit.discount());
            order.setPointsDiscount(benefit.loyaltyQuote().pointsDiscount());
            checkoutBenefitService.applySnapshot(order, benefit);
            BigDecimal shipping = order.getShippingFee() == null ? BigDecimal.ZERO : order.getShippingFee();
            order.setTotalAmount(subtotal.subtract(benefit.discount()).subtract(benefit.loyaltyQuote().pointsDiscount())
                    .add(shipping).setScale(2, RoundingMode.HALF_UP));
            checkoutBenefitService.recordHold(order.getId(), benefit);
        } else if (order.getStatus() != OrderStatus.SHIPPING && order.getStatus() != OrderStatus.PENDING
                && order.getStatus() != OrderStatus.CONFIRMED && order.getStatus() != OrderStatus.PACKING) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Order is not in a payable state");
        }

        BigDecimal totalAmount = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal cashReceived;
        BigDecimal cashChange;
        BigDecimal totalActualPaid = totalAmount;

        // 7. Xử lý tính toán tiền khách đưa và tiền thừa
        if (paymentMethod.getType() == PaymentMethodType.CASH) {
            if (req.getAmountPaid().compareTo(totalAmount) < 0) {
                throw new AppException(ErrorCode.PAYMENT_AMOUNT_INSUFFICIENT,
                        String.format("Số tiền thanh toán (%.2f) không đủ thanh toán tổng đơn hàng (%.2f)",
                                req.getAmountPaid(), totalAmount));
            }
            cashReceived = req.getAmountPaid().setScale(2, RoundingMode.HALF_UP);
            cashChange = cashReceived.subtract(totalAmount).setScale(2, RoundingMode.HALF_UP);
        } else {
            // Các phương thức phi tiền mặt (BANK_TRANSFER, VNPAY_QR, MOMO)
            cashReceived = totalAmount;
            cashChange = BigDecimal.ZERO;
        }

        // Thuế VAT 8% tính trên tổng tiền
        BigDecimal vatAmount = totalAmount.multiply(BigDecimal.valueOf(0.08)).setScale(2, RoundingMode.HALF_UP);

        // 8. Khấu trừ tồn kho Omnichannel cho đơn POS (DRAFT -> COMPLETED)
        if (order.getStatus() == OrderStatus.DRAFT) {
            if (order.getDetails() != null) {
                for (OrderDetail detail : order.getDetails().stream()
                        .sorted(Comparator.comparing(row -> row.getVariant().getId())).toList()) {
                    Inventory inv = inventoryRepository.findByVariantIdForUpdate(detail.getVariant().getId())
                            .orElseThrow(() -> new AppException(ErrorCode.INVENTORY_NOT_FOUND));
                    if (inv.getAvailableStock() < detail.getQuantity()) {
                        throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
                    }
                    inv.setPhysicalStock(inv.getPhysicalStock() - detail.getQuantity());
                    inv.setAvailableStock(inv.getAvailableStock() - detail.getQuantity());
                    inventoryRepository.save(inv);
                }
            }
            order.setStatus(OrderStatus.COMPLETED);
        } else if (order.getStatus() == OrderStatus.PENDING) {
            order.setStatus(OrderStatus.CONFIRMED);
        }
        orderRepository.save(order);

        // 9. Sinh mã hóa đơn duy nhất dạng HD-YYYYMMDD-XXX. Serialize code allocation per DB
        //    transaction so concurrent settlements cannot observe the same count/existence result.
        invoiceRepository.lockInvoiceCodeGeneration(0x4641534541524348L); // 'FASEARCH' advisory key
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "HD-" + dateStr + "-";
        long countToday = invoiceRepository.countByInvoiceCodeStartingWith(prefix) + 1;
        String invoiceCode = String.format("%s%03d", prefix, countToday);
        while (invoiceRepository.existsByInvoiceCode(invoiceCode)) {
            countToday++;
            invoiceCode = String.format("%s%03d", prefix, countToday);
        }

        // 10. Lưu thông tin hóa đơn (Invoice)
        Invoice invoice = Invoice.builder()
                .invoiceCode(invoiceCode)
                .order(order)
                .employee(employee)
                .paymentMethodCode(paymentMethod.getType())
                .vatAmount(vatAmount)
                .totalActualPaid(totalActualPaid)
                .cashReceived(cashReceived)
                .cashChange(cashChange)
                .status(PaymentStatus.PAID)
                .note(req.getNote())
                .build();
        invoice = invoiceRepository.save(invoice);

        // 11. Lưu thông tin giao dịch thanh toán (Payment)
        String transactionCode = "TXN-" + System.currentTimeMillis();
        if (totalActualPaid.signum() > 0) {
            Payment payment = Payment.builder()
                    .invoice(invoice)
                    .paymentMethod(paymentMethod)
                    .amount(totalActualPaid)
                    .transactionCode(transactionCode)
                    .status(PaymentStatus.PAID)
                    .note(req.getNote())
                    .build();
            paymentRepository.save(payment);
        }
        checkoutBenefitService.consume(order.getId());
        if (order.getLoyaltyQuoteFingerprint() != null) {
            loyaltyService.settleOrder(order, totalActualPaid);
        } else {
            // Pre-S2 orders keep the legacy fixed-rate award, settled atomically by the loyalty module.
            loyaltyService.settleLegacyEarn(order, totalActualPaid);
        }

        return new PaymentResult(invoiceResponse(invoice, order), false);
    }

    private boolean matchesPosReplay(PaymentProcessReq request, Order order, Invoice invoice, int requestedPoints) {
        if (invoice.getPaymentMethodCode() != request.getPaymentMethodCode()
                || invoice.getCashReceived() == null
                || invoice.getCashReceived().compareTo(request.getAmountPaid()) != 0
                || !Objects.equals(invoice.getNote(), request.getNote())
                || requestedPoints != (order.getRedeemedPoints() == null ? 0 : order.getRedeemedPoints())
                || !normalizeCode(request.getVoucherCode()).equals(normalizeCode(order.getVoucherCode()))) return false;
        boolean hasBenefit = !normalizeCode(order.getVoucherCode()).isEmpty() || requestedPoints > 0;
        if (hasBenefit) return Objects.equals(request.getQuoteFingerprint(), order.getLoyaltyQuoteFingerprint());
        return request.getQuoteFingerprint() == null || request.getQuoteFingerprint().isBlank()
                || Objects.equals(request.getQuoteFingerprint(), order.getLoyaltyQuoteFingerprint());
    }

    private InvoiceRes invoiceResponse(Invoice invoice, Order order) {
        boolean s2 = order.getLoyaltyQuoteFingerprint() != null;
        return InvoiceRes.builder().invoiceId(invoice.getId()).invoiceCode(invoice.getInvoiceCode())
                .orderId(order.getId()).orderCode(order.getOrderCode())
                .totalActualPaid(invoice.getTotalActualPaid()).vatAmount(invoice.getVatAmount())
                .cashReceived(invoice.getCashReceived()).cashChange(invoice.getCashChange())
                .paymentStatus(invoice.getStatus()).paymentMethod(invoice.getPaymentMethodCode())
                .note(invoice.getNote()).issuedAt(invoice.getIssuedAt() == null ? LocalDateTime.now() : invoice.getIssuedAt())
                .redeemedPoints(s2 ? (order.getRedeemedPoints() == null ? 0 : order.getRedeemedPoints()) : null)
                .pointsDiscount(s2 ? order.getPointsDiscount() : null)
                .loyaltyPolicyId(s2 ? order.getLoyaltyPolicyId() : null)
                .loyaltyPolicyVersion(s2 ? order.getLoyaltyPolicyVersion() : null)
                .redeemCurrencyPerPointSnapshot(s2 ? order.getRedeemCurrencyPerPointSnapshot() : null)
                .earnedPoints(s2 && order.getLoyaltyPolicyId() != null ? order.getEarnedPoints() : null)
                .build();
    }

    private static String normalizeCode(String code) {
        return code == null ? "" : code.strip().toUpperCase(Locale.ROOT);
    }
}
