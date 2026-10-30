package com.springboot.fasearch.modules.payment.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
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

        // 5. Only the persisted checkout snapshot is authoritative; request codes cannot add discounts.
        BigDecimal voucherDiscount = order.getDiscountAmount() == null ? BigDecimal.ZERO : order.getDiscountAmount();
        if (req.getVoucherCode() != null && !req.getVoucherCode().isBlank()
                && !req.getVoucherCode().trim().equalsIgnoreCase(order.getVoucherCode())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Voucher must be applied during checkout");
        }

        // 6. Tính giảm giá điểm thưởng (1 điểm = 1.000 VNĐ)
        BigDecimal pointDiscount = BigDecimal.ZERO;
        if (req.getRedeemedPoints() != null && req.getRedeemedPoints() > 0) {
            if (order.getCustomer() == null) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn hàng của khách vãng lai không thể sử dụng điểm tích lũy");
            }

            int availablePoints = order.getCustomer().getAccumulatePoint() != null
                    ? order.getCustomer().getAccumulatePoint()
                    : 0;

            if (req.getRedeemedPoints() > availablePoints) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        String.format("Số điểm tích lũy sử dụng (%d) vượt quá số điểm hiện có của khách hàng (%d)",
                                req.getRedeemedPoints(), availablePoints));
            }

            pointDiscount = BigDecimal.valueOf(req.getRedeemedPoints())
                    .multiply(BigDecimal.valueOf(1000))
                    .setScale(2, RoundingMode.HALF_UP);

            // Điểm thưởng tối đa không vượt quá giá trị tiền hàng sau khi trừ voucher
            BigDecimal remainingSubTotal = subTotal.subtract(voucherDiscount);
            if (remainingSubTotal.compareTo(BigDecimal.ZERO) > 0 && pointDiscount.compareTo(remainingSubTotal) > 0) {
                pointDiscount = remainingSubTotal;
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
    public InvoiceRes processPayment(PaymentProcessReq req) {
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

        // 3. Kiểm tra đơn hàng đã thanh toán trước đó chưa
        if (invoiceRepository.existsByOrderIdAndStatus(order.getId(), PaymentStatus.PAID)) {
            throw new AppException(ErrorCode.ORDER_ALREADY_PAID);
        }

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

        // 6. Kiểm tra phương thức thanh toán
        PaymentMethod paymentMethod = paymentMethodRepository.findByTypeAndStatus(req.getPaymentMethodCode(), "ACTIVE")
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_METHOD_NOT_FOUND));
        if (order.getVoucherCode() != null && isCustomer) throw new AppException(ErrorCode.FORBIDDEN);
        if (order.getVoucherCode() != null && (order.getStatus() != OrderStatus.SHIPPING
                || paymentMethod.getType() != PaymentMethodType.CASH)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Voucher COD orders can only be collected in cash by staff after handoff");
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
                for (OrderDetail detail : order.getDetails()) {
                    Inventory inv = inventoryRepository.findByVariantId(detail.getVariant().getId())
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

        // 9. Sinh mã hóa đơn duy nhất dạng HD-YYYYMMDD-XXX
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

        // S1 keeps loyalty out of voucher checkout; S2 replaces this legacy rule with policy/ledger.
        if (order.getCustomer() != null && order.getVoucherCode() == null) {
            Customer customer = order.getCustomer();
            int pointsEarned = totalActualPaid.divide(BigDecimal.valueOf(100000), 0, RoundingMode.FLOOR).intValue();
            if (pointsEarned > 0) {
                int currentPoints = customer.getAccumulatePoint() != null ? customer.getAccumulatePoint() : 0;
                customer.setAccumulatePoint(currentPoints + pointsEarned);
                userRepository.save(customer);
            }
        }

        // 13. Trả về kết quả hóa đơn đã thanh toán
        return InvoiceRes.builder()
                .invoiceId(invoice.getId())
                .invoiceCode(invoice.getInvoiceCode())
                .orderId(order.getId())
                .orderCode(order.getOrderCode())
                .totalActualPaid(invoice.getTotalActualPaid())
                .vatAmount(invoice.getVatAmount())
                .cashReceived(invoice.getCashReceived())
                .cashChange(invoice.getCashChange())
                .paymentStatus(invoice.getStatus())
                .paymentMethod(paymentMethod.getType())
                .note(invoice.getNote())
                .issuedAt(invoice.getIssuedAt() != null ? invoice.getIssuedAt() : LocalDateTime.now())
                .build();
    }
}
