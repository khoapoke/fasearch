package com.springboot.fasearch.modules.trash.controller;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.trash.dto.response.TrashItemRes;
import com.springboot.fasearch.modules.trash.service.interfaces.TrashService;
import com.springboot.fasearch.shared.ApiResponse;
import com.springboot.fasearch.shared.PageResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;

/**
 * Thùng rác cho sản phẩm, biến thể, danh mục, khách hàng, hồ sơ nhân sự và tài khoản đăng nhập.
 * ADMIN và STAFF xem/khôi phục dữ liệu nghiệp vụ; riêng tab tài khoản chỉ ADMIN, và không có
 * endpoint xóa vĩnh viễn nào.
 */
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/v1/admin/trash")
@RequiredArgsConstructor
public class TrashController {

    private final TrashService trashService;

    @GetMapping("/products")
    @PreAuthorize("hasAuthority('PERM_TRASH_VIEW')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<TrashItemRes>> getDeletedProducts(
            @ParameterObject @PageableDefault(page = 0, size = 20) Pageable pageable) {
        return ApiResponse.success(200, "Lấy danh sách sản phẩm đã xóa thành công",
                trashService.listDeletedProducts(pageable));
    }

    @GetMapping("/variants")
    @PreAuthorize("hasAuthority('PERM_TRASH_VIEW')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<TrashItemRes>> getDeletedVariants(
            @ParameterObject @PageableDefault(page = 0, size = 20) Pageable pageable) {
        return ApiResponse.success(200, "Lấy danh sách biến thể đã xóa thành công",
                trashService.listDeletedVariants(pageable));
    }

    @GetMapping("/categories")
    @PreAuthorize("hasAuthority('PERM_TRASH_VIEW')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<TrashItemRes>> getDeletedCategories(
            @ParameterObject @PageableDefault(page = 0, size = 20) Pageable pageable) {
        return ApiResponse.success(200, "Lấy danh sách danh mục đã xóa thành công",
                trashService.listDeletedCategories(pageable));
    }

    @GetMapping("/customers")
    @PreAuthorize("hasAuthority('PERM_TRASH_VIEW')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<TrashItemRes>> getDeletedCustomers(
            @ParameterObject @PageableDefault(page = 0, size = 20) Pageable pageable) {
        return ApiResponse.success(200, "Lấy danh sách khách hàng đã xóa thành công",
                trashService.listDeletedCustomers(pageable));
    }

    @GetMapping("/employees")
    @PreAuthorize("hasAuthority('PERM_TRASH_VIEW')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<TrashItemRes>> getDeletedEmployees(
            @ParameterObject @PageableDefault(page = 0, size = 20) Pageable pageable) {
        return ApiResponse.success(200, "Lấy danh sách hồ sơ nhân sự đã xóa thành công",
                trashService.listDeletedEmployees(pageable));
    }

    @GetMapping("/accounts")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<PageResponse<TrashItemRes>> getDeletedAccounts(
            @ParameterObject @PageableDefault(page = 0, size = 20) Pageable pageable) {
        return ApiResponse.success(200, "Lấy danh sách tài khoản đã xóa thành công",
                trashService.listDeletedAccounts(pageable));
    }

    @PostMapping("/products/{id}/restore")
    @PreAuthorize("hasAuthority('PERM_TRASH_RESTORE')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> restoreProduct(@PathVariable Long id) {
        trashService.restoreProduct(id);
        return ApiResponse.success(200, "Khôi phục sản phẩm thành công", true);
    }

    @PostMapping("/variants/{id}/restore")
    @PreAuthorize("hasAuthority('PERM_TRASH_RESTORE')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> restoreVariant(@PathVariable Long id) {
        trashService.restoreVariant(id);
        return ApiResponse.success(200, "Khôi phục biến thể thành công", true);
    }

    @PostMapping("/categories/{id}/restore")
    @PreAuthorize("hasAuthority('PERM_TRASH_RESTORE')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> restoreCategory(@PathVariable Long id) {
        trashService.restoreCategory(id);
        return ApiResponse.success(200, "Khôi phục danh mục thành công", true);
    }

    @PostMapping("/customers/{id}/restore")
    @PreAuthorize("hasAuthority('PERM_TRASH_RESTORE')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> restoreCustomer(@PathVariable Long id) {
        trashService.restoreCustomer(id);
        return ApiResponse.success(200, "Khôi phục khách hàng thành công", true);
    }

    @PostMapping("/employees/{id}/restore")
    @PreAuthorize("hasAuthority('PERM_TRASH_RESTORE')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> restoreEmployee(@PathVariable Long id) {
        trashService.restoreEmployee(id);
        return ApiResponse.success(200, "Khôi phục hồ sơ nhân sự thành công", true);
    }

    @PostMapping("/accounts/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Boolean> restoreAccount(@PathVariable Long id) {
        trashService.restoreAccount(id);
        return ApiResponse.success(200, "Khôi phục tài khoản thành công", true);
    }
}
