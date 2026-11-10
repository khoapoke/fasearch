package com.springboot.fasearch.modules.payment.client;

import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
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

    /** Expire an open Checkout Session after the order was cancelled. Idempotent: Stripe returns the
     *  session with status=expired; a session already paid/complete cannot be expired and throws,
     *  in which case the caller must leave the attempt for the webhook REVIEW path. */
    private static RestClient expireClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        return RestClient.builder().baseUrl(API).requestFactory(factory).build();
    }

    public void expireSession(String sessionId) {
        requireConfigured();
        if (sessionId == null || sessionId.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Thiếu mã phiên Stripe.");
        }
        try {
            String body = expireClient().post()
                    .uri("/v1/checkout/sessions/{id}/expire", sessionId)
                    .header("Authorization", "Bearer " + secretKey)
                    .retrieve()
                    .body(String.class);
            if (body == null || body.isBlank()) {
                return;
            }
            JsonNode root = OBJECT_MAPPER.readTree(body);
            String status = root.path("status").asText("");
            if ("expired".equals(status)) {
                return;
            }
            // HTTP 200 without expired status: Stripe accepted the call; the webhook settles the final state.
            return;
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED,
                    "Stripe đã từ chối việc hủy phiên thanh toán (HTTP " + e.getStatusCode().value() + ")");
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "Dịch vụ hủy phiên Stripe hiện không khả dụng.");
        }
    }

    RestClient refundClient() { return expireClient(); }

    public record RefundAttempt(int number, String refundId, String status, String idempotencyKey) {}

    public String refundSession(String sessionId, java.math.BigDecimal amount,
            java.math.BigDecimal paid, String returnKey) {
        return refundSession(sessionId, amount, paid, returnKey, attempt -> {});
    }

    /** Reconcile ALL matching metadata, including legacy refunds without attempt_number.
     * Only terminal failed/canceled refunds permit a new key; pending/unknown must reconcile. */
    public String refundSession(String sessionId, java.math.BigDecimal amount,
            java.math.BigDecimal paid, String returnKey, java.util.function.Consumer<RefundAttempt> record) {
        requireConfigured();
        int nextAttempt = 1;
        boolean posting = false;
        try {
            RestClient client = refundClient();
            String auth = "Bearer " + secretKey;
            JsonNode session = OBJECT_MAPPER.readTree(client.get().uri("/v1/checkout/sessions/{id}", sessionId)
                    .header("Authorization", auth).retrieve().body(String.class));
            String intent = session.path("payment_intent").asText("");
            if (session.path("livemode").asBoolean(true) || !"paid".equals(session.path("payment_status").asText())
                    || !"vnd".equals(session.path("currency").asText()) || intent.isBlank()
                    || session.path("amount_total").asLong(-1) != paid.longValueExact())
                throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED, "Phiên Stripe không khớp thanh toán của đơn.");
            String after = "";
            String succeeded = null;
            boolean pending = false;
            do {
                final String cursor = after;
                JsonNode page = OBJECT_MAPPER.readTree(client.get().uri(b -> {
                    b.path("/v1/refunds").queryParam("payment_intent", intent).queryParam("limit", 100);
                    if (!cursor.isEmpty()) b.queryParam("starting_after", cursor);
                    return b.build();
                }).header("Authorization", auth).retrieve().body(String.class));
                for (JsonNode refund : page.path("data")) {
                    after = refund.path("id").asText();
                    if (!returnKey.equals(refund.path("metadata").path("return_key").asText())) continue;
                    validateRefund(refund, amount, intent);
                    int number = Math.max(1, refund.path("metadata").path("attempt_number").asInt(1));
                    String status = refund.path("status").asText();
                    record.accept(new RefundAttempt(number, after, status, refundKey(returnKey, number)));
                    if ("succeeded".equals(status)) succeeded = after;
                    else if ("failed".equals(status) || "canceled".equals(status)) nextAttempt = Math.max(nextAttempt, number + 1);
                    else pending = true;
                }
                if (!page.path("has_more").asBoolean(false)) break;
                if (cursor.equals(after)) throw new IllegalStateException("Invalid Stripe cursor");
            } while (true);
            if (succeeded != null) return succeeded;
            if (pending) throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED,
                    "Stripe chưa hoàn tiền thành công. Giữ nguyên yêu cầu để đối soát lại.");
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("payment_intent", intent);
            form.add("amount", amount.setScale(0, RoundingMode.UNNECESSARY).toPlainString());
            form.add("metadata[return_key]", returnKey);
            form.add("metadata[attempt_number]", Integer.toString(nextAttempt));
            posting = true;
            JsonNode refund = OBJECT_MAPPER.readTree(client.post().uri("/v1/refunds")
                    .header("Authorization", auth).header("Idempotency-Key", refundKey(returnKey, nextAttempt))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(String.class));
            validateRefund(refund, amount, intent);
            String status = refund.path("status").asText();
            record.accept(new RefundAttempt(nextAttempt, refund.path("id").asText(), status, refundKey(returnKey, nextAttempt)));
            posting = false;
            if ("failed".equals(status) || "canceled".equals(status))
                throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED, "Stripe từ chối hoàn tiền, thử lại");
            if (!"succeeded".equals(status)) throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED,
                    "Stripe chưa hoàn tiền thành công. Giữ nguyên yêu cầu để đối soát lại.");
            return refund.path("id").asText();
        } catch (AppException e) { throw e;
        } catch (RestClientResponseException e) {
            if (posting) record.accept(new RefundAttempt(nextAttempt, null, "unknown", refundKey(returnKey, nextAttempt)));
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED, "Stripe từ chối hoàn tiền, thử lại");
        } catch (Exception e) {
            if (posting) record.accept(new RefundAttempt(nextAttempt, null, "unknown", refundKey(returnKey, nextAttempt)));
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
                    "Chưa xác nhận được hoàn tiền Stripe. Thử lại cùng yêu cầu để đối soát, không tạo yêu cầu mới.");
        }
    }

    private static String refundKey(String returnKey, int attempt) {
        return "fasearch-return-" + returnKey + "-" + attempt;
    }

    private static void validateRefund(JsonNode refund, java.math.BigDecimal amount, String intent) {
        if (refund.path("id").asText().isBlank() || !"vnd".equals(refund.path("currency").asText())
                || !intent.equals(refund.path("payment_intent").asText())
                || refund.path("amount").asLong(-1) != amount.longValueExact())
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED, "Thông tin hoàn tiền Stripe không khớp yêu cầu.");
    }

    public StripeSession createSession(PaymentAttemptRes attempt) {
        requireConfigured();
        long amount;
        try {
            amount = attempt.getAmount().setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        } catch (ArithmeticException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Số tiền VND phải là số nguyên.");
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
            if (id.isBlank() || url.isBlank()) throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED, "Stripe không trả về URL phiên thanh toán.");
            return new StripeSession(id, url);
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_REJECTED,
                    "Stripe Checkout đã từ chối yêu cầu (HTTP " + e.getStatusCode().value() + ")");
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "Stripe Checkout hiện không khả dụng.");
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
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, "Chưa cấu hình chế độ thử nghiệm Stripe.");
        }
        if (successUrl == null || successUrl.isBlank() || cancelUrl == null || cancelUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, "Chưa cấu hình URL trả về của Stripe.");
        }
    }
}
