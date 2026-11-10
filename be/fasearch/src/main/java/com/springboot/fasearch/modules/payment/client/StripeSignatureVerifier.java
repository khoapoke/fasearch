package com.springboot.fasearch.modules.payment.client;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

/** Stripe-Signature: t=<unix>,v1=<hex hmac-sha256(secret, t + "." + rawBody)>. */
@Component
public class StripeSignatureVerifier {
    public boolean verify(String rawPayload, String signatureHeader, String secret, long toleranceSeconds) {
        if (rawPayload == null || signatureHeader == null || secret == null || secret.isBlank()) return false;
        if (toleranceSeconds <= 0 || toleranceSeconds > 3600) return false;
        java.util.List<String> timestamps = new java.util.ArrayList<>();
        java.util.List<String> signatures = new java.util.ArrayList<>();
        for (String part : signatureHeader.split(",")) {
            int eq = part.indexOf('=');
            if (eq < 1) continue;
            String key = part.substring(0, eq).trim();
            String value = part.substring(eq + 1).trim();
            if ("t".equals(key)) timestamps.add(value);
            if ("v1".equals(key)) signatures.add(value);
        }
        if (timestamps.size() != 1 || signatures.isEmpty()) return false;
        long timestamp;
        try {
            timestamp = Long.parseLong(timestamps.get(0));
        } catch (NumberFormatException e) {
            return false;
        }
        long now = System.currentTimeMillis() / 1000L;
        if (Math.abs(now - timestamp) > toleranceSeconds) return false;
        byte[] expected = hmacSha256Hex(secret, timestamp + "." + rawPayload).getBytes(StandardCharsets.UTF_8);
        for (String signature : signatures) {
            if (MessageDigest.isEqual(expected, signature.getBytes(StandardCharsets.UTF_8))) return true;
        }
        return false;
    }

    public String hmacSha256Hex(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot verify Stripe signature", e);
        }
    }
}
