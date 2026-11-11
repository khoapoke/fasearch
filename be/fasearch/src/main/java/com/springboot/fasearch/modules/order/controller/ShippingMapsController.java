package com.springboot.fasearch.modules.order.controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import com.springboot.fasearch.modules.order.client.GoogleMapsClient;
import com.springboot.fasearch.exception.*;
import com.springboot.fasearch.security.SecurityUtils;
import com.springboot.fasearch.shared.ApiResponse;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/shipping/maps")
@PreAuthorize("hasRole('CUSTOMER')")
@RequiredArgsConstructor
public class ShippingMapsController {
    private final GoogleMapsClient maps;
    private void allow() { maps.allow(SecurityUtils.getCurrentUsername().orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED))); }
    @GetMapping("/autocomplete")
    public ApiResponse<java.util.List<GoogleMapsClient.Suggestion>> autocomplete(@RequestParam String input) {
        if (input.isBlank() || input.length()>200) throw new AppException(ErrorCode.INVALID_REQUEST);
        allow(); return ApiResponse.success(200,"Địa chỉ gợi ý",maps.autocomplete(input.strip()));
    }
    @GetMapping("/geocode")
    public ApiResponse<GoogleMapsClient.Location> geocode(@RequestParam(required=false) String address,@RequestParam(required=false) String placeId) {
        if ((address==null || address.isBlank() || address.length()>255) && (placeId==null || placeId.isBlank() || placeId.length()>255))
            throw new AppException(ErrorCode.INVALID_REQUEST);
        allow(); return ApiResponse.success(200,"Vị trí giao hàng",maps.geocode(address,placeId));
    }
}
