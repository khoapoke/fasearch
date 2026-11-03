package com.springboot.fasearch.modules.payment.attempt.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.attempt.dto.PaymentEventCommand;
import com.springboot.fasearch.modules.payment.attempt.dto.request.PaymentAttemptCreateReq;
import com.springboot.fasearch.modules.payment.attempt.dto.response.PaymentAttemptRes;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentAttempt;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentAttemptStatus;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentEvent;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentEventStatus;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.attempt.repository.PaymentAttemptRepository;
import com.springboot.fasearch.modules.payment.attempt.repository.PaymentEventRepository;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.payment.entity.Payment;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentMethodRepository;
import com.springboot.fasearch.modules.payment.repository.PaymentRepository;
import com.springboot.fasearch.modules.payment.attempt.service.interfaces.PaymentAttemptService;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.CheckoutBenefitService;
import com.springboot.fasearch.modules.loyalty.service.LoyaltyService;
import com.springboot.fasearch.modules.payment.entity.PaymentMethod;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.SecurityUtils;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PaymentAttemptServiceImpl implements PaymentAttemptService {
    private final PaymentAttemptRepository attemptRepository;
    private final PaymentEventRepository eventRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentMethodRepository paymentMethodRepository;
    private final PaymentRepository paymentRepository;
    private final CheckoutBenefitService checkoutBenefitService;
    private final LoyaltyService loyaltyService;

    @Override
    @Transactional
    public PaymentAttemptRes create(PaymentAttemptCreateReq request) {
        Customer customer = currentCustomer();
        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (order.getCustomer() == null || !order.getCustomer().getId().equals(customer.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.RETURNED
                || order.getStatus() == OrderStatus.COMPLETED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Order is not payable");
        }
        if (order.getTotalAmount() == null || order.getTotalAmount().signum() <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Zero-due orders require local settlement");
        }
        PaymentAttempt existing = attemptRepository.findByProviderAndIdempotencyKey(
                request.getProvider(), request.getIdempotencyKey()).orElse(null);
        if (existing != null) {
            if (!existing.getOrder().getId().equals(order.getId())) {
                throw new AppException(ErrorCode.DATA_CONFLICT, "Idempotency key belongs to another order");
            }
            return response(existing);
        }
        PaymentAttempt attempt = PaymentAttempt.builder()
                .order(order).provider(request.getProvider())
                .amount(order.getTotalAmount()).currency("VND")
                .status(PaymentAttemptStatus.CREATED)
                .idempotencyKey(request.getIdempotencyKey().strip())
                .providerReference("SKELETON-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now())
                .build();
        return response(attemptRepository.save(attempt));
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentAttemptRes get(Long id) {
        Customer customer = currentCustomer();
        PaymentAttempt attempt = attemptRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment attempt not found"));
        if (attempt.getOrder().getCustomer() == null
                || !attempt.getOrder().getCustomer().getId().equals(customer.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        return response(attempt);
    }

    @Override
    @Transactional
    public void attachProviderSession(Long id, String reference, String checkoutUrl) {
        PaymentAttempt attempt = attemptRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment attempt not found"));
        attempt.setProviderReference(reference);
        attempt.setProviderSessionId(reference);
        attempt.setProviderCheckoutUrl(checkoutUrl);
        attempt.setUpdatedAt(LocalDateTime.now());
        attemptRepository.save(attempt);
    }

    @Override
    @Transactional
    public void recordProviderEvent(PaymentEventCommand command) {
        PaymentAttempt attempt = attemptRepository.findByProviderAndProviderReferenceForUpdate(
                command.provider(), command.providerReference())
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment attempt not found"));
        if (command.amount() == null || command.amount().compareTo(attempt.getAmount()) != 0
                || command.currency() == null || !command.currency().equalsIgnoreCase(attempt.getCurrency())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Provider amount/currency mismatch");
        }
        PaymentEvent existing = eventRepository.findByProviderAndProviderEventId(
                command.provider(), command.providerEventId()).orElse(null);
        if (existing != null) {
            if (existing.getPayloadSha256().equals(command.payloadSha256())) return;
            throw new AppException(ErrorCode.DATA_CONFLICT, "Provider event payload changed");
        }
        if (command.outcome() == com.springboot.fasearch.modules.payment.attempt.entity.ProviderEventOutcome.SUCCESS) {
            settleVerifiedSuccess(attempt, command);
            return;
        }
        PaymentEventStatus eventStatus = PaymentEventStatus.PROCESSED;
        PaymentAttemptStatus next = attempt.getStatus();
        if (command.outcome() == com.springboot.fasearch.modules.payment.attempt.entity.ProviderEventOutcome.FAILURE) {
            next = PaymentAttemptStatus.FAILED;
        } else if (command.outcome() == com.springboot.fasearch.modules.payment.attempt.entity.ProviderEventOutcome.CANCELLED) {
            next = PaymentAttemptStatus.CANCELLED;
        } else if (command.outcome() == com.springboot.fasearch.modules.payment.attempt.entity.ProviderEventOutcome.EXPIRED) {
            next = PaymentAttemptStatus.EXPIRED;
        }
        attempt.setStatus(next);
        attempt.setUpdatedAt(LocalDateTime.now());
        attemptRepository.save(attempt);
        eventRepository.save(PaymentEvent.builder()
                .provider(command.provider()).providerEventId(command.providerEventId())
                .attempt(attempt).order(attempt.getOrder()).payloadSha256(command.payloadSha256())
                .status(eventStatus).receivedAt(LocalDateTime.now())
                .processedAt(LocalDateTime.now()).build());
    }

    private void settleVerifiedSuccess(PaymentAttempt attempt, PaymentEventCommand command) {
        Order order = orderRepository.findByIdForUpdate(attempt.getOrder().getId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.RETURNED
                || order.getStatus() == OrderStatus.COMPLETED) {
            markReview(attempt, command, "order already closed; no automatic fulfillment or refund");
            return;
        }
        if (attempt.getStatus() == PaymentAttemptStatus.CANCELLED
                || attempt.getStatus() == PaymentAttemptStatus.EXPIRED) {
            markReview(attempt, command, "late provider success after cancel/expiry; manual review required");
            return;
        }
        if (attempt.getAmount() == null || attempt.getAmount().signum() <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Zero-due orders require local settlement");
        }
        if (invoiceRepository.findByOrderId(order.getId()).isPresent()) {
            attempt.setStatus(PaymentAttemptStatus.SETTLED);
            attempt.setUpdatedAt(LocalDateTime.now());
            attemptRepository.save(attempt);
            eventRepository.save(PaymentEvent.builder()
                    .provider(command.provider()).providerEventId(command.providerEventId())
                    .attempt(attempt).order(order).payloadSha256(command.payloadSha256())
                    .status(PaymentEventStatus.DUPLICATE).receivedAt(LocalDateTime.now())
                    .processedAt(LocalDateTime.now()).build());
            return;
        }
        if (order.getStatus() != OrderStatus.PENDING && order.getStatus() != OrderStatus.CONFIRMED
                && order.getStatus() != OrderStatus.PACKING && order.getStatus() != OrderStatus.SHIPPING) {
            markReview(attempt, command, "order not in payable state");
            return;
        }
        PaymentMethodType methodType = attempt.getProvider()
                == com.springboot.fasearch.modules.payment.attempt.entity.PaymentProvider.VNPAY
                ? PaymentMethodType.VNPAY_QR : PaymentMethodType.STRIPE;
        PaymentMethod paymentMethod = paymentMethodRepository.findByTypeAndStatus(methodType, "ACTIVE")
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED));
        BigDecimal totalAmount = order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount();
        if (totalAmount.signum() <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Zero-due orders require local settlement");
        }
        invoiceRepository.lockInvoiceCodeGeneration(0x4641534541524348L);
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "HD-" + dateStr + "-";
        long countToday = invoiceRepository.countByInvoiceCodeStartingWith(prefix) + 1;
        String invoiceCode = String.format("%s%03d", prefix, countToday);
        while (invoiceRepository.existsByInvoiceCode(invoiceCode)) {
            countToday++;
            invoiceCode = String.format("%s%03d", prefix, countToday);
        }
        BigDecimal vatAmount = totalAmount.multiply(BigDecimal.valueOf(0.08)).setScale(2, java.math.RoundingMode.HALF_UP);
        Invoice invoice = Invoice.builder()
                .invoiceCode(invoiceCode)
                .order(order)
                .employee(null)
                .paymentMethodCode(paymentMethod.getType())
                .vatAmount(vatAmount)
                .totalActualPaid(totalAmount)
                .cashReceived(totalAmount)
                .cashChange(BigDecimal.ZERO)
                .status(PaymentStatus.PAID)
                .note("Provider " + attempt.getProvider() + " " + attempt.getProviderReference())
                .build();
        invoice = invoiceRepository.save(invoice);
        Payment payment = Payment.builder()
                .invoice(invoice)
                .paymentMethod(paymentMethod)
                .amount(totalActualPaid(invoice))
                .transactionCode("PROV-" + attempt.getId() + "-" + command.providerEventId())
                .status(PaymentStatus.PAID)
                .note(invoice.getNote())
                .build();
        paymentRepository.save(payment);
        if (order.getStatus() == OrderStatus.PENDING) {
            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.save(order);
        }
        checkoutBenefitService.consume(order.getId());
        if (order.getLoyaltyQuoteFingerprint() != null) {
            loyaltyService.settleOrder(order, totalActualPaid(invoice));
        } else {
            loyaltyService.settleLegacyEarn(order, totalActualPaid(invoice));
        }
        attempt.setStatus(PaymentAttemptStatus.SETTLED);
        attempt.setUpdatedAt(LocalDateTime.now());
        attemptRepository.save(attempt);
        eventRepository.save(PaymentEvent.builder()
                .provider(command.provider()).providerEventId(command.providerEventId())
                .attempt(attempt).order(order).payloadSha256(command.payloadSha256())
                .status(PaymentEventStatus.PROCESSED).receivedAt(LocalDateTime.now())
                .processedAt(LocalDateTime.now()).build());
    }

    private BigDecimal totalActualPaid(Invoice invoice) {
        return invoice.getTotalActualPaid() == null ? BigDecimal.ZERO : invoice.getTotalActualPaid();
    }

    private void markReview(PaymentAttempt attempt, PaymentEventCommand command, String reason) {
        attempt.setStatus(PaymentAttemptStatus.REVIEW_REQUIRED);
        attempt.setUpdatedAt(LocalDateTime.now());
        attemptRepository.save(attempt);
        eventRepository.save(PaymentEvent.builder()
                .provider(command.provider()).providerEventId(command.providerEventId())
                .attempt(attempt).order(attempt.getOrder()).payloadSha256(command.payloadSha256())
                .status(PaymentEventStatus.REVIEW_REQUIRED).receivedAt(LocalDateTime.now())
                .processedAt(LocalDateTime.now()).errorCode(reason).build());
    }
    private Customer currentCustomer() {
        String username = SecurityUtils.getCurrentUsername().orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        return userRepository.findByAccount_Username(username)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));
    }

    private PaymentAttemptRes response(PaymentAttempt attempt) {
        return PaymentAttemptRes.builder().id(attempt.getId()).orderId(attempt.getOrder().getId())
                .provider(attempt.getProvider()).status(attempt.getStatus()).amount(attempt.getAmount())
                .currency(attempt.getCurrency()).providerReference(attempt.getProviderReference())
                .checkoutUrl(attempt.getProviderCheckoutUrl())
                .createdAt(attempt.getCreatedAt()).expiresAt(attempt.getExpiresAt()).build();
    }
}
