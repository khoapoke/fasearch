package com.springboot.fasearch.modules.user.controller;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.user.dto.request.CustomerCreateReq;
import com.springboot.fasearch.modules.user.dto.request.CustomerUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.service.interfaces.UserService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@SecurityRequirement(name = "BearerAuth")
@RestController 
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/customers")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<PageResponse<CustomerRes>>> getCustomers(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long tierId,
            @RequestParam(required = false) Long salesTierId) {

        PageResponse<CustomerRes> result = userService.getCustomers(pageable, keyword, tierId, salesTierId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(200, "Lấy danh sách khách hàng thành công", result));
    }

    @GetMapping("/customers/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    public ResponseEntity<ApiResponse<CustomerRes>> getCustomer(@PathVariable Long id) {
        CustomerRes response = userService.getCustomerById(id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(200, "Lấy thông tin khách hàng thành công", response));
    }

    @PostMapping("/customers")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CustomerRes> createCustomer(@Valid @RequestBody CustomerCreateReq req) {
        CustomerRes result = userService.createCustomer(req);
        return ApiResponse.success(201, "Thêm khách hàng thành công", result);
    }

    @RequestMapping(value = "/customers/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CustomerRes> updateCustomer(
            @PathVariable Long id,
            @Valid @RequestBody CustomerUpdateReq req) {
        CustomerRes result = userService.updateCustomer(id, req);
        return ApiResponse.success(200, "Cập nhật hồ sơ khách hàng thành công", result);
    }

    @DeleteMapping("/customers/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> deleteCustomer(@PathVariable Long id) {
        userService.deleteCustomer(id);
        return ApiResponse.success(200, "Xóa khách hàng thành công", true);
    }
}
