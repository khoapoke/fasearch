package com.springboot.fasearch.modules.payment.attempt.provider;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.payment.attempt.dto.response.PaymentAttemptRes;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class VnpayCheckoutService {
    @Value("${VNPAY_ENV:}")
    private String environment;
    @Value("${VNPAY_TMN_CODE:}")
    private String tmnCode;
    @Value("${VNPAY_HASH_SECRET:}")
    private String hashSecret;
    @Value("${VNPAY_PAY_URL:}")
    private String payUrl;
    @Value("${VNPAY_RETURN_URL:}")
    private String returnUrl;

    private final VnpaySignatureVerifier signatureVerifier;

    public record VnpayPaymentUrl(String txnRef, String paymentUrl) {}

    public VnpayPaymentUrl createPaymentUrl(PaymentAttemptRes attempt, String ipAddress) {
        requireConfigured();
        long amountMinor;
        try {
            amountMinor = attempt.getAmount().multiply(BigDecimal.valueOf(100))
                    .setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        } catch (ArithmeticException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "VND amount must be a whole number");
        }
        String txnRef = "VNPAY" + attempt.getId() + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        TreeMap<String, String> params = new TreeMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", tmnCode);
        params.put("vnp_Amount", Long.toString(amountMinor));
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", "Thanh toan don " + attempt.getOrderId());
        params.put("vnp_OrderType", "other");
        params.put("vnp_Locale", "vn");
        params.put("vnp_ReturnUrl", withAttemptContext(returnUrl, attempt));
        params.put("vnp_IpAddr", normalizeIp(ipAddress));
        params.put("vnp_CreateDate", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        String secureHash = signatureVerifier.sign(params, hashSecret);
        params.put("vnp_SecureHash", secureHash);
        return new VnpayPaymentUrl(txnRef, payUrl + "?" + query(params));
    }

    // Return URL carries this attempt's own context; the page it lands on is display-only.
    private static String withAttemptContext(String base, PaymentAttemptRes attempt) {
        String separator = base.contains("?") ? "&" : "?";
        return base + separator + "orderId=" + attempt.getOrderId() + "&attemptId=" + attempt.getId();
    }

    public String query(Map<String, String> params) {
        StringBuilder result = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (result.length() > 0) result.append('&');
            result.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
                    .append('=').append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        return result.toString();
    }

    private void requireConfigured() {
        if (!"sandbox".equalsIgnoreCase(environment) || tmnCode == null || tmnCode.isBlank()
                || hashSecret == null || hashSecret.isBlank() || payUrl == null || payUrl.isBlank()
                || returnUrl == null || returnUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, "VNPAY sandbox is not configured");
        }
    }

    private String normalizeIp(String ip) {
        if (ip == null || ip.isBlank() || "0:0:0:0:0:0:0:1".equals(ip)) return "127.0.0.1";
        return ip;
    }
}
