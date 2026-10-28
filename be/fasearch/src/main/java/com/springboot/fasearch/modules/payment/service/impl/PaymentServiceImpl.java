package com.springboot.fasearch.modules.payment.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.dto.request.PaymentCalculateReq;
import com.springboot.fasearch.modules.payment.dto.response.PaymentCalculationRes;
import com.springboot.fasearch.modules.payment.service.interfaces.PaymentService;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

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

        // 5. Tính giảm giá Voucher
        BigDecimal voucherDiscount = BigDecimal.ZERO;
        if (req.getVoucherCode() != null && !req.getVoucherCode().isBlank()) {
            String code = req.getVoucherCode().trim();
            if (code.equalsIgnoreCase("FASEARCH10")) {
                // Áp dụng voucher 10% theo đặc tả API
                voucherDiscount = subTotal.multiply(BigDecimal.valueOf(0.10)).setScale(2, RoundingMode.HALF_UP);
            } else if (order.getDiscountAmount() != null && order.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
                voucherDiscount = order.getDiscountAmount();
            }
        } else if (order.getDiscountAmount() != null) {
            voucherDiscount = order.getDiscountAmount();
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
}
