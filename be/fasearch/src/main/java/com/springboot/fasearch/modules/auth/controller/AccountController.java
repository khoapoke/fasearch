package com.springboot.fasearch.modules.auth.controller;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
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

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.dto.request.AccountCreateReq;
import com.springboot.fasearch.modules.auth.dto.request.AccountUpdateReq;
import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.service.interfaces.AuthService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/v1/auth/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AuthService authService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<AccountInfoRes>> getAccounts(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) RoleType role,
            @RequestParam(required = false) AccountStatus status) {

        PageResponse<AccountInfoRes> result = authService.getAccounts(pageable, keyword, role, status);
        return ApiResponse.success(200, "Lấy danh sách tài khoản thành công", result);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AccountInfoRes> createInternalAccount(@Valid @RequestBody AccountCreateReq req) {
        AccountInfoRes result = authService.createInternalAccount(req);
        return ApiResponse.success(201, "Tạo tài khoản mới thành công", result);
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<AccountInfoRes> updateAccount(
            @PathVariable Long id,
            @Valid @RequestBody AccountUpdateReq req) {
        AccountInfoRes result = authService.updateAccount(id, req);
        return ApiResponse.success(200, "Cập nhật tài khoản thành công", result);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> deleteAccount(@PathVariable Long id) {
        authService.deleteAccount(id);
        return ApiResponse.success(200, "Xóa tài khoản thành công", true);
    }
}
