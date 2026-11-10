package com.springboot.fasearch.modules.payment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.modules.payment.dto.response.PaymentAttemptRes;

/**
 * Provider return URLs must carry this attempt's own context (orderId + attemptId) so the
 * result page resolves an authoritative attempt instead of guessing from a bare route.
 * Ported from the reviewed payments fix (BE 7bd81c14).
 */
class ProviderReturnContextTest {

    private static PaymentAttemptRes attempt() {
        return PaymentAttemptRes.builder().id(77L).orderId(42L).build();
    }

    private static String invoke(Class<?> owner, String name, String base) throws Exception {
        Method m = owner.getDeclaredMethod(name, String.class, PaymentAttemptRes.class);
        m.setAccessible(true);
        return (String) m.invoke(null, base, attempt());
    }

    @Test
    void stripeReturnUrlCarriesOrderAndAttempt() throws Exception {
        String url = invoke(com.springboot.fasearch.modules.payment.client.StripeCheckoutService.class,
                "returnUrl", "http://127.0.0.1:3189/thanh-toan/ket-qua");
        assertEquals("http://127.0.0.1:3189/thanh-toan/ket-qua?orderId=42&attemptId=77", url);
    }

    @Test
    void stripeReturnUrlKeepsExistingQuery() throws Exception {
        String url = invoke(com.springboot.fasearch.modules.payment.client.StripeCheckoutService.class,
                "returnUrl", "http://127.0.0.1:3189/ket-qua?src=stripe");
        assertTrue(url.contains("src=stripe&orderId=42&attemptId=77"), url);
    }

    @Test
    void vnpayReturnUrlCarriesOrderAndAttempt() throws Exception {
        String url = invoke(com.springboot.fasearch.modules.payment.client.VnpayCheckoutService.class,
                "withAttemptContext", "http://127.0.0.1:3189/thanh-toan/ket-qua");
        assertEquals("http://127.0.0.1:3189/thanh-toan/ket-qua?orderId=42&attemptId=77", url);
    }

    @Test
    void vnpayReturnUrlKeepsExistingQuery() throws Exception {
        String url = invoke(com.springboot.fasearch.modules.payment.client.VnpayCheckoutService.class,
                "withAttemptContext", "http://127.0.0.1:3189/ket-qua?src=vnpay");
        assertTrue(url.contains("src=vnpay&orderId=42&attemptId=77"), url);
    }
}
