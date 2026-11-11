package com.springboot.fasearch.modules.payment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.client.StripeCheckoutService;
import com.springboot.fasearch.modules.payment.entity.PaymentAttempt;
import com.springboot.fasearch.modules.payment.entity.PaymentAttemptStatus;
import com.springboot.fasearch.modules.payment.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.repository.PaymentAttemptRepository;
import com.springboot.fasearch.modules.payment.service.impl.CancelledOrderStripeExpiry;

@ExtendWith(MockitoExtension.class)
class CancelledOrderStripeExpiryTest {

    @Mock
    private PaymentAttemptRepository attemptRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private StripeCheckoutService stripeCheckoutService;
    @InjectMocks
    private CancelledOrderStripeExpiry expiry;

    private Order cancelledOrder(Long id) {
        return Order.builder().id(id).orderCode("DH-CANCEL-" + id).status(OrderStatus.CANCELLED).build();
    }

    private PaymentAttempt attempt(Long id, Long orderId, PaymentProvider provider,
            PaymentAttemptStatus status, String sessionId) {
        Order order = cancelledOrder(orderId);
        return PaymentAttempt.builder().id(id).order(order).provider(provider)
                .amount(new BigDecimal("225000")).currency("VND").status(status)
                .idempotencyKey("key-" + id).providerReference(sessionId)
                .providerSessionId(sessionId).createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now()).build();
    }

    @Test
    void expireOpenStripeAttemptAfterCancel() {
        Order order = cancelledOrder(94L);
        PaymentAttempt open = attempt(25L, 94L, PaymentProvider.STRIPE,
                PaymentAttemptStatus.CREATED, "cs_test_open123");
        when(orderRepository.findById(94L)).thenReturn(Optional.of(order));
        when(attemptRepository.findByOrder_Id(94L)).thenReturn(List.of(open));
        when(attemptRepository.expireIfOpen(anyLong(), any(), any(), any(), any()))
                .thenReturn(1);

        expiry.expireAfterCommit(94L);

        verify(stripeCheckoutService).expireSession("cs_test_open123");
        verify(attemptRepository).expireIfOpen(org.mockito.ArgumentMatchers.eq(25L),
                org.mockito.ArgumentMatchers.eq(PaymentProvider.STRIPE),
                org.mockito.ArgumentMatchers.eq(java.util.List.of(PaymentAttemptStatus.CREATED, PaymentAttemptStatus.PENDING)),
                org.mockito.ArgumentMatchers.eq(PaymentAttemptStatus.EXPIRED), any());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void stripeFailureDoesNotFailCancellationAndKeepsAttempt() {
        Order order = cancelledOrder(95L);
        PaymentAttempt open = attempt(26L, 95L, PaymentProvider.STRIPE,
                PaymentAttemptStatus.CREATED, "cs_test_fail456");
        when(orderRepository.findById(95L)).thenReturn(Optional.of(order));
        when(attemptRepository.findByOrder_Id(95L)).thenReturn(List.of(open));
        doThrow(new AppException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "down"))
                .when(stripeCheckoutService).expireSession("cs_test_fail456");

        expiry.expireAfterCommit(95L);

        // No exception escapes; the conditional update is never reached so the webhook still handles the open attempt.
        verify(attemptRepository, never()).expireIfOpen(anyLong(), any(), any(), any(), any());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void alreadySettledAttemptUntouched() {
        Order order = cancelledOrder(96L);
        PaymentAttempt settled = attempt(27L, 96L, PaymentProvider.STRIPE,
                PaymentAttemptStatus.SETTLED, "cs_test_settled789");
        when(orderRepository.findById(96L)).thenReturn(Optional.of(order));
        when(attemptRepository.findByOrder_Id(96L)).thenReturn(List.of(settled));

        expiry.expireAfterCommit(96L);

        verify(stripeCheckoutService, never()).expireSession(any());
        verify(attemptRepository, never()).expireIfOpen(anyLong(), any(), any(), any(), any());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void conditionalUpdateSkipsSettledAndReviewRequired() {
        // Repository-call assertion (no usable @DataJpaTest pattern for attempts): the conditional
        // update only matches CREATED/PENDING, so SETTLED and REVIEW_REQUIRED are no-ops.
        // Deleting the WHERE status guard (or re-adding a read-check-write) fails this test.
        when(attemptRepository.expireIfOpen(anyLong(), any(), any(), any(), any())).thenReturn(0);

        expiry.markExpired(27L);
        expiry.markExpired(28L);

        org.mockito.ArgumentCaptor<java.util.Collection<PaymentAttemptStatus>> openCaptor =
                org.mockito.ArgumentCaptor.forClass(java.util.Collection.class);
        verify(attemptRepository, org.mockito.Mockito.times(2)).expireIfOpen(anyLong(),
                org.mockito.ArgumentMatchers.eq(PaymentProvider.STRIPE), openCaptor.capture(),
                org.mockito.ArgumentMatchers.eq(PaymentAttemptStatus.EXPIRED), any());
        for (java.util.Collection<PaymentAttemptStatus> open : openCaptor.getAllValues()) {
            org.junit.jupiter.api.Assertions.assertTrue(open.contains(PaymentAttemptStatus.CREATED));
            org.junit.jupiter.api.Assertions.assertTrue(open.contains(PaymentAttemptStatus.PENDING));
            org.junit.jupiter.api.Assertions.assertFalse(open.contains(PaymentAttemptStatus.SETTLED));
            org.junit.jupiter.api.Assertions.assertFalse(open.contains(PaymentAttemptStatus.REVIEW_REQUIRED));
            org.junit.jupiter.api.Assertions.assertFalse(open.contains(PaymentAttemptStatus.SETTLEMENT_PENDING));
        }
        verify(attemptRepository, never()).save(any());
        verify(attemptRepository, never()).findById(anyLong());
    }

    @Test
    void noAttemptMakesNoStripeCall() {
        Order order = cancelledOrder(97L);
        when(orderRepository.findById(97L)).thenReturn(Optional.of(order));
        when(attemptRepository.findByOrder_Id(97L)).thenReturn(List.of());

        expiry.expireAfterCommit(97L);

        verify(stripeCheckoutService, never()).expireSession(any());
        verify(attemptRepository, never()).expireIfOpen(anyLong(), any(), any(), any(), any());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void vnpayAttemptsAreLeftUntouched() {
        Order order = cancelledOrder(98L);
        PaymentAttempt vnpay = attempt(28L, 98L, PaymentProvider.VNPAY,
                PaymentAttemptStatus.CREATED, "vnpay-ref-1");
        when(orderRepository.findById(98L)).thenReturn(Optional.of(order));
        when(attemptRepository.findByOrder_Id(98L)).thenReturn(List.of(vnpay));

        expiry.expireAfterCommit(98L);

        verify(stripeCheckoutService, never()).expireSession(any());
        verify(attemptRepository, never()).expireIfOpen(anyLong(), any(), any(), any(), any());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void nonCancelledOrderMakesNoCall() {
        Order pending = Order.builder().id(99L).orderCode("DH-PENDING-99").status(OrderStatus.PENDING).build();
        when(orderRepository.findById(99L)).thenReturn(Optional.of(pending));

        expiry.expireAfterCommit(99L);

        verify(attemptRepository, never()).findByOrder_Id(anyLong());
        verify(stripeCheckoutService, never()).expireSession(any());
    }

    @Test
    void markExpiredRunsInItsOwnNewTransaction() throws Exception {
        var method = CancelledOrderStripeExpiry.class.getMethod("markExpired", Long.class);
        var tx = method.getAnnotation(org.springframework.transaction.annotation.Transactional.class);
        org.junit.jupiter.api.Assertions.assertNotNull(tx,
                "markExpired must stay transactional so the write commits");
        assertEquals(org.springframework.transaction.annotation.Propagation.REQUIRES_NEW, tx.propagation(),
                "markExpired must commit in a fresh transaction outside the order's already-committed one");
    }

    @Test
    void oneStripeFailureDoesNotBlockNextAttempt() {
        Order order = cancelledOrder(100L);
        PaymentAttempt first = attempt(30L, 100L, PaymentProvider.STRIPE,
                PaymentAttemptStatus.CREATED, "cs_test_first");
        PaymentAttempt second = attempt(31L, 100L, PaymentProvider.STRIPE,
                PaymentAttemptStatus.PENDING, "cs_test_second");
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(attemptRepository.findByOrder_Id(100L)).thenReturn(List.of(first, second));
        when(attemptRepository.expireIfOpen(anyLong(), any(), any(), any(), any())).thenReturn(1);
        doThrow(new AppException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "down"))
                .when(stripeCheckoutService).expireSession("cs_test_first");

        expiry.expireAfterCommit(100L);

        verify(stripeCheckoutService).expireSession("cs_test_first");
        verify(stripeCheckoutService).expireSession("cs_test_second");
        // First attempt never reaches the conditional update; second still expires in its own transaction.
        verify(attemptRepository, never()).expireIfOpen(org.mockito.ArgumentMatchers.eq(30L), any(), any(), any(), any());
        verify(attemptRepository).expireIfOpen(org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq(PaymentProvider.STRIPE), any(),
                org.mockito.ArgumentMatchers.eq(PaymentAttemptStatus.EXPIRED), any());
        verify(attemptRepository, never()).save(any());
    }
}
