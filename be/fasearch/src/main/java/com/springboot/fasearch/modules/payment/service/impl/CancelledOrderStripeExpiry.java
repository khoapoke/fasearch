package com.springboot.fasearch.modules.payment.service.impl;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.client.StripeCheckoutService;
import com.springboot.fasearch.modules.payment.entity.PaymentAttempt;
import com.springboot.fasearch.modules.payment.entity.PaymentAttemptStatus;
import com.springboot.fasearch.modules.payment.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.repository.PaymentAttemptRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Expire open Stripe Checkout Sessions after an order is cancelled.
 * Called AFTER the order transaction commits, so a Stripe failure can never
 * roll back the cancellation and no HTTP call holds a DB transaction open.
 * VNPay has no equivalent and is left untouched.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CancelledOrderStripeExpiry {

    private final PaymentAttemptRepository attemptRepository;
    private final OrderRepository orderRepository;
    private final StripeCheckoutService stripeCheckoutService;
    // Self proxy so internal calls go through the transaction interceptor. In unit tests without
    // Spring this stays null and the calls fall back to direct (this) invocation.
    private final ObjectProvider<CancelledOrderStripeExpiry> self;

    public record AttemptRef(Long attemptId, String sessionId) {}

    public void expireAfterCommit(Long orderId) {
        CancelledOrderStripeExpiry proxy = self != null && self.getIfAvailable() != null
                ? self.getIfAvailable()
                : this;
        List<AttemptRef> refs;
        try {
            refs = proxy.collectOpenStripeAttempts(orderId);
        } catch (Exception e) {
            log.warn("Stripe expire collection failed for order id={} {}: {}", orderId, e.getClass().getSimpleName(), e.getMessage(), e);
            return;
        }
        for (AttemptRef ref : refs) {
            try {
                stripeCheckoutService.expireSession(ref.sessionId());
                proxy.markExpired(ref.attemptId());
            } catch (Exception e) {
                // Keep the attempt in its open state so the existing webhook path still handles it safely
                // (a session already paid when expire arrives keeps today's REVIEW behaviour).
                log.warn("Stripe expire failed for order id={} attempt id={} {}: {}", orderId, ref.attemptId(), e.getClass().getSimpleName(), e.getMessage(), e);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<AttemptRef> collectOpenStripeAttempts(Long orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null || order.getStatus() != com.springboot.fasearch.common.enums.OrderStatus.CANCELLED) {
            return List.of();
        }
        return attemptRepository.findByOrder_Id(orderId).stream()
                .filter(a -> a.getProvider() == PaymentProvider.STRIPE)
                .filter(a -> a.getStatus() == PaymentAttemptStatus.CREATED
                        || a.getStatus() == PaymentAttemptStatus.PENDING)
                .map(a -> {
                    String sessionId = a.getProviderSessionId();
                    if (sessionId == null || sessionId.isBlank()) {
                        String ref = a.getProviderReference();
                        sessionId = (ref != null && ref.startsWith("cs_")) ? ref : null;
                    }
                    return sessionId == null || sessionId.isBlank() ? null
                            : new AttemptRef(a.getId(), sessionId);
                })
                .filter(r -> r != null)
                .toList();
    }

    // Each write commits in its own new transaction, outside the order's already-committed
    // transaction: the afterCommit callback runs with no active transaction, and REQUIRES_NEW
    // guarantees a fresh commit per attempt (one Stripe failure never blocks the next attempt).
    // The Stripe HTTP call stays outside any DB transaction.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markExpired(Long attemptId) {
        // Single conditional update: a concurrent webhook result can never be overwritten.
        // Only open Stripe attempts move to EXPIRED; SETTLED and REVIEW_REQUIRED are never touched.
        // A session that fails to expire stays as it is (caller leaves the attempt for the webhook path).
        attemptRepository.expireIfOpen(attemptId, PaymentProvider.STRIPE,
                java.util.List.of(PaymentAttemptStatus.CREATED, PaymentAttemptStatus.PENDING),
                PaymentAttemptStatus.EXPIRED, LocalDateTime.now());
    }
}
