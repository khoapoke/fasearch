package com.springboot.fasearch.modules.order.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.springboot.fasearch.exception.*;
import com.springboot.fasearch.modules.order.client.GoogleMapsClient;
import com.springboot.fasearch.modules.order.dto.response.ShippingFeeRes;
import com.springboot.fasearch.modules.order.service.interfaces.ShippingService;

@Service
public class ShippingServiceImpl implements ShippingService {
    private final GoogleMapsClient maps;
    private double latitude, longitude;
    private final double roadFactor;
    @Value("${shipping.warehouse.address:140 Lê Trọng Tấn, Tân Phú, TP.HCM}")
    private String warehouseAddress;
    @jakarta.annotation.PostConstruct
    void resolveWarehouse() {
        if (maps.enabled()) {
            try { var location=maps.geocode(warehouseAddress,null); latitude=location.latitude(); longitude=location.longitude(); }
            catch (AppException ignored) { /* configured OSM coordinates remain available */ }
        }
    }
    private final double nearKm, middleKm, outerKm;
    private final long nearFee, middleFee, outerFee, perKm, cap;
    public ShippingServiceImpl(GoogleMapsClient maps,
        @Value("${shipping.warehouse.latitude:10.8070354}") double latitude,
        @Value("${shipping.warehouse.longitude:106.6287031}") double longitude,
        @Value("${shipping.road-factor:1.3}") double roadFactor,
        @Value("${shipping.tiers.near-km:3}") double nearKm,
        @Value("${shipping.tiers.middle-km:7}") double middleKm,
        @Value("${shipping.tiers.outer-km:15}") double outerKm,
        @Value("${shipping.tiers.near-fee:15000}") long nearFee,
        @Value("${shipping.tiers.middle-fee:25000}") long middleFee,
        @Value("${shipping.tiers.outer-fee:35000}") long outerFee,
        @Value("${shipping.tiers.extra-per-km:3000}") long perKm,
        @Value("${shipping.tiers.cap:150000}") long cap) {
        this.maps=maps; this.latitude=latitude; this.longitude=longitude; this.roadFactor=roadFactor;
        this.nearKm=nearKm; this.middleKm=middleKm; this.outerKm=outerKm;
        this.nearFee=nearFee; this.middleFee=middleFee; this.outerFee=outerFee; this.perKm=perKm; this.cap=cap;
    }
    public static void validateCoordinates(Double lat, Double lng) {
        if ((lat == null) != (lng == null) || (lat != null && (!Double.isFinite(lat) || !Double.isFinite(lng)
            || lat < -90 || lat > 90 || lng < -180 || lng > 180))) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tọa độ giao hàng phải là một cặp hợp lệ.");
        }
    }
    public static double haversine(double lat1, double lng1, double lat2, double lng2) {
        double a = Math.pow(Math.sin(Math.toRadians(lat2-lat1)/2),2)
            + Math.cos(Math.toRadians(lat1))*Math.cos(Math.toRadians(lat2))*Math.pow(Math.sin(Math.toRadians(lng2-lng1)/2),2);
        return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1,a)));
    }
    @Override public ShippingFeeRes quote(Double lat, Double lng) {
        validateCoordinates(lat,lng);
        if (lat == null) throw new AppException(ErrorCode.INVALID_REQUEST, "Thiếu tọa độ giao hàng.");
        Double google = maps.distance(latitude, longitude, lat, lng);
        double distance = google == null ? haversine(latitude,longitude,lat,lng)*roadFactor : google;
        long fee = Math.min(cap, distance <= nearKm ? nearFee : distance <= middleKm ? middleFee
            : distance <= outerKm ? outerFee : outerFee+(long)Math.ceil(distance-outerKm)*perKm);
        BigDecimal amount=BigDecimal.valueOf(fee).setScale(2);
        return ShippingFeeRes.builder().distanceKm(BigDecimal.valueOf(distance).setScale(3,RoundingMode.HALF_UP).doubleValue())
            .shippingFee(amount).baseFee(amount).shippingDiscount(BigDecimal.ZERO).method(google == null ? "estimate" : "google")
            .estimatedDays("1 - 3 ngày").build();
    }
}
