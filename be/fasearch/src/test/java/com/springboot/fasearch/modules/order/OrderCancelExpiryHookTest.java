package com.springboot.fasearch.modules.order;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.order.dto.request.OrderCancelReq;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.CartItemRepository;
import com.springboot.fasearch.modules.order.repository.CartRepository;
import com.springboot.fasearch.modules.order.repository.CheckoutIdempotencyRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.service.impl.OrderServiceImpl;
import com.springboot.fasearch.modules.order.service.interfaces.ShippingService;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.service.impl.CancelledOrderStripeExpiry;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.repository.EmployeeRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;

class OrderCancelExpiryHookTest {

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private OrderServiceImpl service(OrderRepository orders, CancelledOrderStripeExpiry expiry,
            CheckoutBenefitService benefits, LoyaltyService loyalty, EmployeeRepository employees) {
        return new OrderServiceImpl(orders, mock(InvoiceRepository.class), mock(CartRepository.class),
                mock(CartItemRepository.class), mock(UserRepository.class), employees,
                mock(InventoryRepository.class), mock(ProductVariantRepository.class),
                benefits, mock(ShippingService.class), loyalty,
                mock(CheckoutIdempotencyRepository.class), expiry,
                mock(com.springboot.fasearch.modules.order.service.impl.OrderItemHistoryBuilder.class),
                mock(org.springframework.context.ApplicationEventPublisher.class));
    }

    private Order pendingOrder(Long id) {
        return Order.builder().id(id).orderCode("DH-20261106-009")
                .status(OrderStatus.PENDING).totalAmount(new BigDecimal("225000"))
                .shippingFee(BigDecimal.ZERO).discountAmount(BigDecimal.ZERO)
                .pointsDiscount(BigDecimal.ZERO).redeemedPoints(0)
                .details(new ArrayList<>()).build();
    }

    private void asAdmin() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", "x",
                        com.springboot.fasearch.security.TestAuthorities.forRole("ADMIN")));
    }

    @Test
    void cancelTriggersStripeExpireAfterCommit() {
        OrderRepository orders = mock(OrderRepository.class);
        CancelledOrderStripeExpiry expiry = mock(CancelledOrderStripeExpiry.class);
        CheckoutBenefitService benefits = mock(CheckoutBenefitService.class);
        LoyaltyService loyalty = mock(LoyaltyService.class);
        EmployeeRepository employees = mock(EmployeeRepository.class);

        Order order = pendingOrder(94L);
        order.setNote("[Người nhận: Lan - 0900000000] | [PACKING]: Ghi chú nội bộ");
        when(orders.findByIdForUpdate(94L)).thenReturn(Optional.of(order));
        when(employees.findByAccount_Username("admin")).thenReturn(Optional.empty());
        when(orders.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        asAdmin();

        service(orders, expiry, benefits, loyalty, employees)
                .cancelOrder(94L, OrderCancelReq.builder().reason("khach doi y").build());

        verify(expiry).expireAfterCommit(94L);
        org.junit.jupiter.api.Assertions.assertEquals(OrderStatus.CANCELLED, order.getStatus());
        org.junit.jupiter.api.Assertions.assertEquals("khach doi y", order.getCancellationReason());
    }

    @Test
    void expireRunsAfterCommitNotBeforeAndNotOnRollback() {
        OrderRepository orders = mock(OrderRepository.class);
        CancelledOrderStripeExpiry expiry = mock(CancelledOrderStripeExpiry.class);
        CheckoutBenefitService benefits = mock(CheckoutBenefitService.class);
        LoyaltyService loyalty = mock(LoyaltyService.class);
        EmployeeRepository employees = mock(EmployeeRepository.class);

        Order order = pendingOrder(95L);
        when(orders.findByIdForUpdate(95L)).thenReturn(Optional.of(order));
        when(employees.findByAccount_Username("admin")).thenReturn(Optional.empty());
        when(orders.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        asAdmin();

        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service(orders, expiry, benefits, loyalty, employees)
                    .cancelOrder(95L, OrderCancelReq.builder().reason("khach doi y").build());
            // Order is CANCELLED in-memory even before commit, but the Stripe hook must wait for afterCommit.
            org.junit.jupiter.api.Assertions.assertEquals(OrderStatus.CANCELLED, order.getStatus());
            verify(expiry, org.mockito.Mockito.never()).expireAfterCommit(any(Long.class));

            for (org.springframework.transaction.support.TransactionSynchronization sync
                    : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
            verify(expiry).expireAfterCommit(95L);
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }

        // Rollback path: afterCommit is never triggered, so expire must never run.
        Order rolledBack = pendingOrder(96L);
        when(orders.findByIdForUpdate(96L)).thenReturn(Optional.of(rolledBack));
        org.mockito.Mockito.clearInvocations(expiry);
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service(orders, expiry, benefits, loyalty, employees)
                    .cancelOrder(96L, OrderCancelReq.builder().reason("khach doi y").build());
            for (org.springframework.transaction.support.TransactionSynchronization sync
                    : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCompletion(org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK);
            }
            verify(expiry, org.mockito.Mockito.never()).expireAfterCommit(any(Long.class));
            org.junit.jupiter.api.Assertions.assertEquals(OrderStatus.CANCELLED, rolledBack.getStatus());
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
