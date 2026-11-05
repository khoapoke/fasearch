package com.springboot.fasearch.modules.payment.controller;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.payment.dto.PaymentEventCommand;
import com.springboot.fasearch.modules.payment.entity.PaymentProvider;
import com.springboot.fasearch.modules.payment.entity.ProviderEventOutcome;
import com.springboot.fasearch.modules.payment.client.StripeSignatureVerifier;
import com.springboot.fasearch.modules.payment.service.interfaces.PaymentAttemptService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/payments/stripe")
@RequiredArgsConstructor
public class StripeWebhookController {
    private final StripeSignatureVerifier signatureVerifier;
    private final PaymentAttemptService paymentAttemptService;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Value("${STRIPE_WEBHOOK_SECRET:}")
    private String webhookSecret;

    @PostMapping("/webhook")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> webhook(@RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        if (webhookSecret == null || webhookSecret.isBlank()
                || !signatureVerifier.verify(payload, signature, webhookSecret, 300)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid Stripe signature");
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(payload);
            String eventId = root.path("id").asText();
            String type = root.path("type").asText();
            JsonNode object = root.path("data").path("object");
            ProviderEventOutcome outcome = switch (type) {
                case "checkout.session.completed" -> "paid".equals(object.path("payment_status").asText())
                        ? ProviderEventOutcome.SUCCESS : null;
                case "checkout.session.async_payment_succeeded" -> ProviderEventOutcome.SUCCESS;
                case "checkout.session.async_payment_failed" -> ProviderEventOutcome.FAILURE;
                case "checkout.session.expired" -> ProviderEventOutcome.EXPIRED;
                default -> null;
            };
            if (outcome == null) return Map.of("received", true, "ignored", true);
            String sessionId = object.path("id").asText();
            long amount = object.path("amount_total").asLong(-1);
            String currency = object.path("currency").asText().toUpperCase();
            if (eventId.isBlank() || sessionId.isBlank() || amount < 0 || currency.isBlank()) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Incomplete Stripe event");
            }
            String payloadHash = HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8)));
            paymentAttemptService.recordProviderEvent(new PaymentEventCommand(
                    PaymentProvider.STRIPE, eventId, sessionId, payloadHash,
                    BigDecimal.valueOf(amount), currency, outcome));
            return Map.of("received", true);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Malformed Stripe event");
        }
    }
}
