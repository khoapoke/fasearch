package com.springboot.fasearch.modules.order.service.interfaces;

import java.time.LocalDate;

import java.util.List;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.modules.order.dto.request.CheckoutReq;
import com.springboot.fasearch.modules.order.dto.request.OrderCancelReq;
import com.springboot.fasearch.modules.order.dto.request.OrderStatusUpdateReq;
import com.springboot.fasearch.modules.order.dto.request.PosDraftOrderReq;
import com.springboot.fasearch.modules.order.dto.response.OrderDetailRes;
import com.springboot.fasearch.modules.order.dto.response.OrderRes;
import com.springboot.fasearch.shared.PageResponse;

public interface OrderService {

    OrderRes checkout(CheckoutReq req);

    PageResponse<OrderRes> getOrders(
            Pageable pageable,
            OrderStatus status,
            String orderCode,
            String customerPhone,
            LocalDate startDate,
            LocalDate endDate);

    OrderDetailRes getOrderById(Long id);

    OrderDetailRes updateOrderStatus(Long id, OrderStatusUpdateReq req);

    OrderDetailRes cancelOrder(Long id, OrderCancelReq req);

    OrderDetailRes createPosDraftOrder(PosDraftOrderReq req);

    List<OrderDetailRes> getPosDraftOrders();
}
