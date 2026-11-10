package com.springboot.fasearch.modules.order.service.interfaces;
import com.springboot.fasearch.modules.order.dto.response.ShippingFeeRes;
public interface ShippingService {
    ShippingFeeRes quote(Double latitude, Double longitude);
}
