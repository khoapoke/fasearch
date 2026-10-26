package com.springboot.fasearch.modules.user.controller;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.service.interfaces.UserService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;

@SecurityRequirement(name = "BearerAuth") // tên giống ở trong OpenApiConfig 

@RestController 
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/customers")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<CustomerRes>> getCustomers(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long tierId) {

        PageResponse<CustomerRes> result = userService.getCustomers(pageable, keyword, tierId);
        return ApiResponse.success(200, "Lấy danh sách khách hàng thành công", result);
    }

    @GetMapping("/customers/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CustomerRes> getCustomer(@PathVariable Long id) {
        CustomerRes response = userService.getCustomerById(id);
        return ApiResponse.success(200, "Lấy thông tin khách hàng thành công", response);
    }
}
