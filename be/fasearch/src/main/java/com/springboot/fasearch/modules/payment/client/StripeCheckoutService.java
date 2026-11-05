package com.springboot.fasearch.modules.payment.client;

import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.payment.dto.response.PaymentAttemptRes;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StripeCheckoutService {
    private static final String API = "https://api.stripe.com";

    @Value("${STRIPE_MODE:}")
    private String mode;
    @Value("${STRIPE_SECRET_KEY:}")
    private String secretKey;
    @Value("${STRIPE_SUCCESS_URL:}")
    private String successUrl;
    @Value("${STRIPE_CANCEL_URL:}")
    private String cancelUrl;
    @Value("${STRIPE_CURRENCY:VND}")
    private String currency;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public record StripeSession(String id, String url) {}

    public StripeSession createSession(PaymentAttemptRes attempt) {
        requireConfigured();
        long amount;
        try {
            amount = attempt.getAmount().setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        } catch (ArithmeticException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "VND amount must be a whole number");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("mode", "payment");
        form.add("success_url", returnUrl(successUrl, attempt));
        form.add("cancel_url", returnUrl(cancelUrl, attempt));
        form.add("client_reference_id", attempt.getProviderReference());
        form.add("line_items[0][price_data][currency]", currency.toLowerCase());
        form.add("line_items[0][price_data][unit_amount]", Long.toString(amount));
        form.add("line_items[0][price_data][product_data][name]", "Order " + attempt.getOrderId());
        form.add("line_items[0][quantity]", "1");
        form.add("metadata[attempt_id]", attempt.getId().toString());
        form.add("metadata[order_id]", attempt.getOrderId().toString());
        form.add("payment_intent_data[metadata][attempt_id]", attempt.getId().toString());
        try {
            String body = RestClient.builder().baseUrl(API).build().post()
                    .uri("/v1/checkout/sessions")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .header("Authorization", "Bearer " + secretKey)
                    .body(form)
                    .retrieve()
                    .body(String.class);
            JsonNode root = OBJECT_MAPPER.readTree(body);
            String id = root.path("id").asText();
            String url = root.path("url").asText();
            if (id.isBlank() || url.isBlank()) throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED, "Stripe returned no session URL");
            return new StripeSession(id, url);
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED,
                    "Stripe Checkout rejected the request (HTTP " + e.getStatusCode().value() + ")");
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "Stripe Checkout is unavailable");
        }
    }

    // Provider return URLs must carry this attempt's own context so the result page
    // resolves an authoritative attempt/order instead of guessing from a bare route.
    private static String returnUrl(String base, PaymentAttemptRes attempt) {
        String separator = base.contains("?") ? "&" : "?";
        return base + separator + "orderId=" + attempt.getOrderId() + "&attemptId=" + attempt.getId();
    }

    private void requireConfigured() {
        if (!"test".equalsIgnoreCase(mode) || secretKey == null || !secretKey.startsWith("sk_test_")) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, "Stripe test mode is not configured");
        }
        if (successUrl == null || successUrl.isBlank() || cancelUrl == null || cancelUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, "Stripe return URLs are not configured");
        }
    }
}
