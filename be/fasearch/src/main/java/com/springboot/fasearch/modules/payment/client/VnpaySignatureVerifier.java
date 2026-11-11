package com.springboot.fasearch.modules.payment.client;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.TreeMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

/** VNPAY 2.1.0: sorted URL-encoded params, HMAC-SHA512 with vnp_HashSecret. */
@Component
public class VnpaySignatureVerifier {
    public boolean verify(Map<String, String> params, String secret) {
        if (params == null || secret == null || secret.isBlank()) return false;
        String supplied = params.get("vnp_SecureHash");
        if (supplied == null || supplied.isBlank()) return false;
        return MessageDigest.isEqual(sign(params, secret).getBytes(StandardCharsets.UTF_8),
                supplied.toLowerCase().getBytes(StandardCharsets.UTF_8));
    }

    public String sign(Map<String, String> params, String secret) {
        TreeMap<String, String> sorted = new TreeMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey();
            if ("vnp_SecureHash".equals(key) || "vnp_SecureHashType".equals(key)) continue;
            if (entry.getValue() != null) sorted.put(key, entry.getValue());
        }
        StringBuilder canonical = new StringBuilder();
        for (Map.Entry<String, String> entry : sorted.entrySet()) {
            if (canonical.length() > 0) canonical.append('&');
            canonical.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
                    .append('=').append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] digest = mac.doFinal(canonical.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Cannot verify VNPAY signature", e);
        }
    }
}
