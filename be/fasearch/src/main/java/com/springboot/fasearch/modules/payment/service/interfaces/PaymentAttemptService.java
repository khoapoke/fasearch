package com.springboot.fasearch.modules.payment.service.interfaces;

import com.springboot.fasearch.modules.payment.dto.PaymentEventCommand;
import com.springboot.fasearch.modules.payment.dto.request.PaymentAttemptCreateReq;
import com.springboot.fasearch.modules.payment.dto.response.PaymentAttemptRes;

public interface PaymentAttemptService {
    PaymentAttemptRes create(PaymentAttemptCreateReq request);
    PaymentAttemptRes get(Long id);
    void recordProviderEvent(PaymentEventCommand command);
    void attachProviderSession(Long id, String reference, String checkoutUrl);
}
