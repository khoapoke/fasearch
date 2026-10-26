package com.springboot.fasearch.modules.user.controller;

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

import com.springboot.fasearch.modules.user.dto.request.EmployeeCreateReq;
import com.springboot.fasearch.modules.user.dto.request.EmployeeUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.EmployeeRes;
import com.springboot.fasearch.modules.user.service.interfaces.EmployeeService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/v1/users/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<EmployeeRes>> getEmployees(
            @ParameterObject @PageableDefault(page = 0, size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String keyword) {

        PageResponse<EmployeeRes> result = employeeService.getEmployees(pageable, keyword);
        return ApiResponse.success(200, "Lấy danh sách nhân viên thành công", result);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<EmployeeRes> getEmployeeById(@PathVariable Long id) {
        EmployeeRes result = employeeService.getEmployeeById(id);
        return ApiResponse.success(200, "Lấy thông tin nhân viên thành công", result);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EmployeeRes> createEmployee(@Valid @RequestBody EmployeeCreateReq req) {
        EmployeeRes result = employeeService.createEmployee(req);
        return ApiResponse.success(201, "Thêm mới nhân viên thành công", result);
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<EmployeeRes> updateEmployee(
            @PathVariable Long id,
            @Valid @RequestBody EmployeeUpdateReq req) {
        EmployeeRes result = employeeService.updateEmployee(id, req);
        return ApiResponse.success(200, "Cập nhật hồ sơ nhân viên thành công", result);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> deleteEmployee(@PathVariable Long id) {
        employeeService.deleteEmployee(id);
        return ApiResponse.success(200, "Xóa nhân viên thành công", true);
    }
}
