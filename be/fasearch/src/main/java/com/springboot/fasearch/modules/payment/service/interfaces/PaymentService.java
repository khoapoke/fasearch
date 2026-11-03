package com.springboot.fasearch.modules.payment.service.interfaces;

import java.util.List;

import com.springboot.fasearch.modules.payment.dto.request.PaymentCalculateReq;
import com.springboot.fasearch.modules.payment.dto.request.PaymentProcessReq;
import com.springboot.fasearch.modules.payment.dto.response.InvoiceRes;
import com.springboot.fasearch.modules.payment.dto.response.PaymentCalculationRes;
import com.springboot.fasearch.modules.payment.dto.response.PaymentMethodRes;

public interface PaymentService {

    PaymentCalculationRes calculatePayment(PaymentCalculateReq req);

    List<PaymentMethodRes> getPaymentMethods();

    PaymentResult processPayment(PaymentProcessReq req);

    record PaymentResult(InvoiceRes receipt, boolean replayed) {}
}
