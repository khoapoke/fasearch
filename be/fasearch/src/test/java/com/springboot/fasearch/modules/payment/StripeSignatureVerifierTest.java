package com.springboot.fasearch.modules.payment;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.modules.payment.client.StripeSignatureVerifier;

class StripeSignatureVerifierTest {
    private final StripeSignatureVerifier verifier = new StripeSignatureVerifier();

    @Test
    void validSignaturePassesAndTamperedFails() {
        String secret = "whsec_test_synthetic";
        String payload = "{\"id\":\"evt_1\",\"type\":\"checkout.session.completed\"}";
        long ts = System.currentTimeMillis() / 1000L;
        String sig = verifier.hmacSha256Hex(secret, ts + "." + payload);
        assertTrue(verifier.verify(payload, "t=" + ts + ",v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload + "x", "t=" + ts + ",v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload, "t=" + (ts - 1000) + ",v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload, "t=not-a-number,v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload, "t=,v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload, "t=999999999999999999999999999,v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload, "t=" + ts + ",t=" + ts + ",v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload, "v1=" + sig, secret, 300));
        assertFalse(verifier.verify(payload, "t=" + ts + ",v1=" + sig, secret, 0));
    }
}
