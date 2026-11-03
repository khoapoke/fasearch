package com.springboot.fasearch.modules.payment.attempt.service.interfaces;

import com.springboot.fasearch.modules.payment.attempt.dto.PaymentEventCommand;
import com.springboot.fasearch.modules.payment.attempt.dto.request.PaymentAttemptCreateReq;
import com.springboot.fasearch.modules.payment.attempt.dto.response.PaymentAttemptRes;

public interface PaymentAttemptService {
    PaymentAttemptRes create(PaymentAttemptCreateReq request);
    PaymentAttemptRes get(Long id);
    void recordProviderEvent(PaymentEventCommand command);
    void attachProviderSession(Long id, String reference, String checkoutUrl);
}
