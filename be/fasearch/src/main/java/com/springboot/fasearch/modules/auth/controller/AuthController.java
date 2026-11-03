package com.springboot.fasearch.modules.auth.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.auth.dto.request.ChangePasswordReq;

import com.springboot.fasearch.modules.auth.dto.request.LoginReq;
import com.springboot.fasearch.modules.auth.dto.request.RegisterReq;
import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.dto.response.AuthRes;
import com.springboot.fasearch.modules.auth.service.interfaces.AuthService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<AuthRes> login(@Valid @RequestBody LoginReq req) {
        AuthRes response = authService.login(req);
        return ApiResponse.success(200, "Đăng nhập thành công", response);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthRes> register(@Valid @RequestBody RegisterReq req) {
        AuthRes response = authService.register(req);
        return ApiResponse.success(201, "Đăng ký tài khoản thành công", response);
    }

    @GetMapping("/my-info")
    @SecurityRequirement(name = "BearerAuth")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<AccountInfoRes> getMyInfo(Authentication authentication) {
        AccountInfoRes response = authService.getMyInfo(authentication.getName());
        return ApiResponse.success(200, "Lấy thông tin tài khoản thành công", response);
    }

    @PostMapping("/change-password")
    @SecurityRequirement(name = "BearerAuth")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Void> changePassword(Authentication authentication, @Valid @RequestBody ChangePasswordReq req) {
        authService.changePassword(authentication.getName(), req.getOldPassword(), req.getNewPassword());
        return ApiResponse.success(200, "Đổi mật khẩu thành công", null);
    }
}
