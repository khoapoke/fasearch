package com.springboot.fasearch.modules.payment;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.modules.payment.client.VnpaySignatureVerifier;

class VnpaySignatureVerifierTest {
    private final VnpaySignatureVerifier verifier = new VnpaySignatureVerifier();

    @Test
    void canonicalSignaturePassesAndTamperedFails() {
        String secret = "synthetic-vnpay-secret";
        Map<String, String> params = new LinkedHashMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", "TESTTMN");
        params.put("vnp_Amount", "1000000");
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", "ORDER-1");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");
        params.put("vnp_SecureHash", verifier.sign(params, secret));
        assertTrue(verifier.verify(params, secret));
        params.put("vnp_Amount", "1000001");
        assertFalse(verifier.verify(params, secret));
    }
}
