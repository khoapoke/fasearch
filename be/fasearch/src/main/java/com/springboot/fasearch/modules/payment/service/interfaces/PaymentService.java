package com.springboot.fasearch.modules.payment.service.interfaces;

import com.springboot.fasearch.modules.payment.dto.request.PaymentCalculateReq;
import com.springboot.fasearch.modules.payment.dto.response.PaymentCalculationRes;

public interface PaymentService {

    PaymentCalculationRes calculatePayment(PaymentCalculateReq req);
}
