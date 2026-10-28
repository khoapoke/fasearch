package com.springboot.fasearch.modules.order.service.interfaces;

import com.springboot.fasearch.modules.order.dto.request.CheckoutReq;
import com.springboot.fasearch.modules.order.dto.response.OrderRes;

public interface OrderService {

    OrderRes checkout(CheckoutReq req);
}
