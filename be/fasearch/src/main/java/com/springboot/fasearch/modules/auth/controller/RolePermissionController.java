package com.springboot.fasearch.modules.auth.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.dto.request.RolePermissionsUpdateReq;
import com.springboot.fasearch.modules.auth.dto.response.RolePermissionAuditRes;
import com.springboot.fasearch.modules.auth.dto.response.RolePermissionsRes;
import com.springboot.fasearch.modules.auth.service.interfaces.RolePermissionService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Phân quyền theo vai trò: CHỈ Quản trị viên (ADMIN), không bật/tắt được cho chính nó. */
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/v1/auth/roles/{role}/permissions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class RolePermissionController {

    private final RolePermissionService rolePermissionService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<RolePermissionsRes> get(@PathVariable RoleType role) {
        return ApiResponse.success(200, "Lấy phân quyền thành công", rolePermissionService.getPermissions(role));
    }

    @PutMapping
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<RolePermissionsRes> replace(@PathVariable RoleType role,
            @Valid @RequestBody RolePermissionsUpdateReq req, Authentication authentication) {
        RolePermissionsRes result = rolePermissionService.replacePermissions(role, req.getPermissions(),
                authentication.getName());
        return ApiResponse.success(200, "Đã lưu phân quyền", result);
    }

    @GetMapping("/audit")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<List<RolePermissionAuditRes>> audit(@PathVariable RoleType role) {
        return ApiResponse.success(200, "Lấy nhật ký phân quyền thành công", rolePermissionService.recentAudit(role));
    }
}
