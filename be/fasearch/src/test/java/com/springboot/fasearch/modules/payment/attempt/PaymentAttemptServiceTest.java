package com.springboot.fasearch.modules.payment.attempt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.attempt.dto.PaymentEventCommand;
import com.springboot.fasearch.modules.payment.attempt.dto.request.PaymentAttemptCreateReq;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentAttempt;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentAttemptStatus;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentEvent;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentEventStatus;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.attempt.entity.ProviderEventOutcome;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.loyalty.service.LoyaltyService;
import com.springboot.fasearch.modules.payment.attempt.repository.PaymentAttemptRepository;
import com.springboot.fasearch.modules.payment.attempt.repository.PaymentEventRepository;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentMethodRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentRepository;
import com.springboot.fasearch.modules.payment.attempt.service.impl.PaymentAttemptServiceImpl;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class PaymentAttemptServiceTest {
    @Mock private PaymentAttemptRepository attemptRepository;
    @Mock private PaymentEventRepository eventRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private PaymentMethodRepository paymentMethodRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private CheckoutBenefitService checkoutBenefitService;
    @Mock private LoyaltyService loyaltyService;

    private PaymentAttemptServiceImpl service;
    private Customer customer;
    private Order order;

    @BeforeEach
    void setUp() {
        service = new PaymentAttemptServiceImpl(attemptRepository, eventRepository, orderRepository, userRepository,
                invoiceRepository, paymentMethodRepository, paymentRepository, checkoutBenefitService, loyaltyService);
        customer = Customer.builder().id(1L).lastName("Demo").build();
        order = Order.builder().id(10L).customer(customer).status(OrderStatus.PENDING)
                .totalAmount(new BigDecimal("100000.00")).build();
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("customer", null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createRejectsCrossAccountOrder() {
        when(userRepository.findByAccount_Username("customer")).thenReturn(Optional.of(customer));
        Customer other = Customer.builder().id(2L).lastName("Other").build();
        Order foreign = Order.builder().id(11L).customer(other).status(OrderStatus.PENDING)
                .totalAmount(new BigDecimal("100000.00")).build();
        when(orderRepository.findById(11L)).thenReturn(Optional.of(foreign));
        PaymentAttemptCreateReq req = new PaymentAttemptCreateReq();
        req.setOrderId(11L); req.setProvider(PaymentProvider.STRIPE); req.setIdempotencyKey("own-1");
        AppException error = assertThrows(AppException.class, () -> service.create(req));
        assertEquals(ErrorCode.FORBIDDEN, error.getErrorCode());
        verify(attemptRepository, never()).save(any());
        // P-4: a foreign order must be rejected before any row lock is taken on it.
        verify(orderRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void createIsIdempotentForSameOrderAndKey() {
        when(userRepository.findByAccount_Username("customer")).thenReturn(Optional.of(customer));
        PaymentAttempt existing = PaymentAttempt.builder().id(5L).order(order).provider(PaymentProvider.STRIPE)
                .amount(new BigDecimal("100000.00")).currency("VND").status(PaymentAttemptStatus.CREATED)
                .idempotencyKey("key-1").build();
        when(orderRepository.findById(10L)).thenReturn(Optional.of(order));
        when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, "key-1"))
                .thenReturn(Optional.of(existing));
        PaymentAttemptCreateReq req = new PaymentAttemptCreateReq();
        req.setOrderId(10L); req.setProvider(PaymentProvider.STRIPE); req.setIdempotencyKey("key-1");
        assertEquals(5L, service.create(req).getId());
        verify(attemptRepository, never()).save(any());
        verify(orderRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void providerAmountMismatchRejected() {
        PaymentAttempt attempt = PaymentAttempt.builder().id(5L).order(order).provider(PaymentProvider.STRIPE)
                .amount(new BigDecimal("100000.00")).currency("VND").status(PaymentAttemptStatus.CREATED)
                .providerReference("ref-1").build();
        when(attemptRepository.findByProviderAndProviderReferenceForUpdate(PaymentProvider.STRIPE, "ref-1"))
                .thenReturn(Optional.of(attempt));
        PaymentEventCommand command = new PaymentEventCommand(PaymentProvider.STRIPE, "evt-1", "ref-1",
                "a".repeat(64), new BigDecimal("99999.00"), "VND", ProviderEventOutcome.SUCCESS);
        AppException error = assertThrows(AppException.class, () -> service.recordProviderEvent(command));
        assertEquals(ErrorCode.INVALID_REQUEST, error.getErrorCode());
    }

    @Test
    void duplicateEventSamePayloadIsNoop() {
        PaymentAttempt attempt = PaymentAttempt.builder().id(5L).order(order).provider(PaymentProvider.STRIPE)
                .amount(new BigDecimal("100000.00")).currency("VND").status(PaymentAttemptStatus.SETTLEMENT_PENDING)
                .providerReference("ref-1").build();
        PaymentEvent existing = PaymentEvent.builder().id(9L).provider(PaymentProvider.STRIPE)
                .providerEventId("evt-1").payloadSha256("a".repeat(64)).status(PaymentEventStatus.PROCESSED).build();
        when(attemptRepository.findByProviderAndProviderReferenceForUpdate(PaymentProvider.STRIPE, "ref-1"))
                .thenReturn(Optional.of(attempt));
        when(eventRepository.findByProviderAndProviderEventId(PaymentProvider.STRIPE, "evt-1"))
                .thenReturn(Optional.of(existing));
        service.recordProviderEvent(new PaymentEventCommand(PaymentProvider.STRIPE, "evt-1", "ref-1",
                "a".repeat(64), new BigDecimal("100000.00"), "VND", ProviderEventOutcome.SUCCESS));
        verify(attemptRepository, never()).save(any());
        verify(eventRepository, never()).save(any());
    }

    @Test
    void lateSuccessAfterCancellationRequiresReview() {
        PaymentAttempt attempt = PaymentAttempt.builder().id(5L).order(order).provider(PaymentProvider.VNPAY)
                .amount(new BigDecimal("100000.00")).currency("VND").status(PaymentAttemptStatus.CANCELLED)
                .providerReference("ref-1").build();
        when(attemptRepository.findByProviderAndProviderReferenceForUpdate(PaymentProvider.VNPAY, "ref-1"))
                .thenReturn(Optional.of(attempt));
        when(eventRepository.findByProviderAndProviderEventId(PaymentProvider.VNPAY, "evt-1"))
                .thenReturn(Optional.empty());
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
        when(attemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(eventRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.recordProviderEvent(new PaymentEventCommand(PaymentProvider.VNPAY, "evt-1", "ref-1",
                "b".repeat(64), new BigDecimal("100000.00"), "VND", ProviderEventOutcome.SUCCESS));
        ArgumentCaptor<PaymentAttempt> attemptCaptor = ArgumentCaptor.forClass(PaymentAttempt.class);
        verify(attemptRepository).save(attemptCaptor.capture());
        assertEquals(PaymentAttemptStatus.REVIEW_REQUIRED, attemptCaptor.getValue().getStatus());
        ArgumentCaptor<PaymentEvent> eventCaptor = ArgumentCaptor.forClass(PaymentEvent.class);
        verify(eventRepository).save(eventCaptor.capture());
        assertEquals(PaymentEventStatus.REVIEW_REQUIRED, eventCaptor.getValue().getStatus());
    }

    @Test
    void failureOutcomeDoesNotSettleOrCancelOrder() {
        PaymentAttempt attempt = PaymentAttempt.builder().id(7L).order(order).provider(PaymentProvider.STRIPE)
                .amount(new BigDecimal("100000.00")).currency("VND").status(PaymentAttemptStatus.PENDING)
                .providerReference("ref-fail").build();
        when(attemptRepository.findByProviderAndProviderReferenceForUpdate(PaymentProvider.STRIPE, "ref-fail"))
                .thenReturn(Optional.of(attempt));
        when(eventRepository.findByProviderAndProviderEventId(PaymentProvider.STRIPE, "evt-fail"))
                .thenReturn(Optional.empty());
        when(attemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(eventRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.recordProviderEvent(new PaymentEventCommand(PaymentProvider.STRIPE, "evt-fail", "ref-fail",
                "c".repeat(64), new BigDecimal("100000.00"), "VND", ProviderEventOutcome.FAILURE));
        ArgumentCaptor<PaymentAttempt> captor = ArgumentCaptor.forClass(PaymentAttempt.class);
        verify(attemptRepository).save(captor.capture());
        assertEquals(PaymentAttemptStatus.FAILED, captor.getValue().getStatus());
        verify(invoiceRepository, never()).save(any());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void zeroDueAttemptRejectedWithoutSettlement() {
        Order zero = Order.builder().id(12L).customer(customer).status(OrderStatus.PENDING)
                .totalAmount(BigDecimal.ZERO).build();
        when(orderRepository.findById(12L)).thenReturn(Optional.of(zero));
        when(userRepository.findByAccount_Username("customer")).thenReturn(Optional.of(customer));
        PaymentAttemptCreateReq req = new PaymentAttemptCreateReq();
        req.setOrderId(12L);
        req.setProvider(PaymentProvider.STRIPE);
        req.setIdempotencyKey("zero-1");
        AppException error = assertThrows(AppException.class, () -> service.create(req));
        assertEquals(ErrorCode.INVALID_REQUEST, error.getErrorCode());
        verify(attemptRepository, never()).save(any());
    }

    private PaymentAttempt attemptWith(long id, String key, PaymentAttemptStatus status) {
        return PaymentAttempt.builder().id(id).order(order).provider(PaymentProvider.STRIPE)
                .amount(new BigDecimal("100000.00")).currency("VND").status(status)
                .idempotencyKey(key).providerReference("ref-" + id).providerCheckoutUrl("https://pay.example/" + id)
                .build();
    }

    private PaymentAttemptCreateReq createReq(String key) {
        PaymentAttemptCreateReq req = new PaymentAttemptCreateReq();
        req.setOrderId(10L); req.setProvider(PaymentProvider.STRIPE); req.setIdempotencyKey(key);
        return req;
    }

    // Plain read only: enough for paths that return an existing attempt or reject without writing.
    private void stubOrderAndCustomer() {
        when(userRepository.findByAccount_Username("customer")).thenReturn(Optional.of(customer));
        when(orderRepository.findById(10L)).thenReturn(Optional.of(order));
    }

    // Paths that may write a new attempt also take the row lock (after the plain-read ownership check).
    private void stubOrderLock() {
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
    }

    @Test
    void createOpensFreshAttemptWhenKeyIsNew() {
        stubOrderAndCustomer();
        stubOrderLock();
        when(attemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var res = service.create(createReq("pay-order-10-STRIPE"));
        ArgumentCaptor<PaymentAttempt> captor = ArgumentCaptor.forClass(PaymentAttempt.class);
        verify(attemptRepository).save(captor.capture());
        assertEquals("pay-order-10-STRIPE", captor.getValue().getIdempotencyKey());
        assertEquals(PaymentAttemptStatus.CREATED, res.getStatus());
    }

    @Test
    void repayAfterTerminalAttemptCreatesFreshAttemptWithDerivedKey() {
        for (PaymentAttemptStatus terminal : List.of(PaymentAttemptStatus.FAILED,
                PaymentAttemptStatus.CANCELLED, PaymentAttemptStatus.EXPIRED)) {
            org.mockito.Mockito.reset(attemptRepository, invoiceRepository, orderRepository);
            stubOrderAndCustomer();
            stubOrderLock();
            PaymentAttempt dead = attemptWith(5L, "pay-order-10-STRIPE", terminal);
            when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, "pay-order-10-STRIPE"))
                    .thenReturn(Optional.of(dead));
            when(attemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
            var res = service.create(createReq("pay-order-10-STRIPE"));
            ArgumentCaptor<PaymentAttempt> captor = ArgumentCaptor.forClass(PaymentAttempt.class);
            verify(attemptRepository).save(captor.capture());
            PaymentAttempt fresh = captor.getValue();
            verify(orderRepository).findById(10L);
            verify(orderRepository).findByIdForUpdate(10L);
            assertEquals("pay-order-10-STRIPE~r1", fresh.getIdempotencyKey());
            assertEquals(PaymentAttemptStatus.CREATED, fresh.getStatus());
            assertNull(fresh.getProviderCheckoutUrl());
            assertNull(res.getCheckoutUrl());
            assertNotEquals(dead.getProviderReference(), fresh.getProviderReference());
        }
    }

    @Test
    void repeatedRepayWhileRetryAttemptIsOpenReturnsSameAttempt() {
        stubOrderAndCustomer();
        PaymentAttempt dead = attemptWith(5L, "k", PaymentAttemptStatus.FAILED);
        PaymentAttempt open = attemptWith(6L, "k~r1", PaymentAttemptStatus.CREATED);
        when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, "k")).thenReturn(Optional.of(dead));
        when(attemptRepository.findFirstByProviderAndOrder_IdAndIdempotencyKeyStartingWithOrderByIdDesc(
                PaymentProvider.STRIPE, 10L, "k~r")).thenReturn(Optional.of(open));
        var res = service.create(createReq("k"));
        assertEquals(6L, res.getId());
        assertEquals("https://pay.example/6", res.getCheckoutUrl());
        verify(attemptRepository, never()).save(any());
        verify(orderRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void secondRepayAfterRetryAlsoTerminalGetsNextSequence() {
        stubOrderAndCustomer();
        stubOrderLock();
        PaymentAttempt dead = attemptWith(5L, "k", PaymentAttemptStatus.FAILED);
        PaymentAttempt deadRetry = attemptWith(6L, "k~r1", PaymentAttemptStatus.EXPIRED);
        when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, "k")).thenReturn(Optional.of(dead));
        when(attemptRepository.findFirstByProviderAndOrder_IdAndIdempotencyKeyStartingWithOrderByIdDesc(
                PaymentProvider.STRIPE, 10L, "k~r")).thenReturn(Optional.of(deadRetry));
        when(attemptRepository.countByProviderAndOrder_IdAndIdempotencyKeyStartingWith(
                PaymentProvider.STRIPE, 10L, "k~r")).thenReturn(1L);
        when(attemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.create(createReq("k"));
        ArgumentCaptor<PaymentAttempt> captor = ArgumentCaptor.forClass(PaymentAttempt.class);
        verify(attemptRepository).save(captor.capture());
        assertEquals("k~r2", captor.getValue().getIdempotencyKey());
    }

    @Test
    void openSettledOrReviewAttemptIsNeverReplaced() {
        for (PaymentAttemptStatus status : List.of(PaymentAttemptStatus.CREATED, PaymentAttemptStatus.PENDING,
                PaymentAttemptStatus.SETTLEMENT_PENDING, PaymentAttemptStatus.SETTLED,
                PaymentAttemptStatus.REVIEW_REQUIRED)) {
            org.mockito.Mockito.reset(attemptRepository, orderRepository);
            stubOrderAndCustomer();
            when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, "k"))
                    .thenReturn(Optional.of(attemptWith(5L, "k", status)));
            assertEquals(5L, service.create(createReq("k")).getId());
            verify(attemptRepository, never()).save(any());
            verify(orderRepository, never()).findByIdForUpdate(any());
        }
    }

    @Test
    void repayRejectedWhenOrderAlreadyHasInvoice() {
        stubOrderAndCustomer();
        stubOrderLock();
        when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, "k"))
                .thenReturn(Optional.of(attemptWith(5L, "k", PaymentAttemptStatus.FAILED)));
        when(invoiceRepository.findByOrderId(10L)).thenReturn(Optional.of(Invoice.builder().id(1L).build()));
        AppException error = assertThrows(AppException.class, () -> service.create(createReq("k")));
        assertEquals(ErrorCode.ORDER_ALREADY_PAID, error.getErrorCode());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void retryKeyFitsColumnForMaxLengthClientKey() {
        stubOrderAndCustomer();
        stubOrderLock();
        String longKey = "x".repeat(100);
        when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, longKey))
                .thenReturn(Optional.of(attemptWith(5L, longKey, PaymentAttemptStatus.FAILED)));
        when(attemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.create(createReq(longKey));
        ArgumentCaptor<PaymentAttempt> captor = ArgumentCaptor.forClass(PaymentAttempt.class);
        verify(attemptRepository).save(captor.capture());
        assertTrue(captor.getValue().getIdempotencyKey().length() <= 100);
        assertEquals("x".repeat(90) + "~r1", captor.getValue().getIdempotencyKey());
    }

    @Test
    void sameKeyForDifferentOrderStillConflicts() {
        stubOrderAndCustomer();
        Order other = Order.builder().id(99L).customer(customer).status(OrderStatus.PENDING)
                .totalAmount(new BigDecimal("1.00")).build();
        PaymentAttempt foreign = PaymentAttempt.builder().id(5L).order(other).provider(PaymentProvider.STRIPE)
                .status(PaymentAttemptStatus.FAILED).idempotencyKey("k").build();
        when(attemptRepository.findByProviderAndIdempotencyKey(PaymentProvider.STRIPE, "k")).thenReturn(Optional.of(foreign));
        AppException error = assertThrows(AppException.class, () -> service.create(createReq("k")));
        assertEquals(ErrorCode.DATA_CONFLICT, error.getErrorCode());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void retryAttemptSuccessEventStillSettlesOnlyThroughVerifiedEventPath() {
        // A fresh retry attempt is CREATED and unpaid; amount checks still guard settlement.
        PaymentAttempt retry = attemptWith(6L, "k~r1", PaymentAttemptStatus.CREATED);
        when(attemptRepository.findByProviderAndProviderReferenceForUpdate(PaymentProvider.STRIPE, "ref-6"))
                .thenReturn(Optional.of(retry));
        AppException error = assertThrows(AppException.class,
                () -> service.recordProviderEvent(new PaymentEventCommand(PaymentProvider.STRIPE, "evt-9", "ref-6",
                        "d".repeat(64), new BigDecimal("1.00"), "VND", ProviderEventOutcome.SUCCESS)));
        assertEquals(ErrorCode.INVALID_REQUEST, error.getErrorCode());
        verify(invoiceRepository, never()).save(any());
    }
}
