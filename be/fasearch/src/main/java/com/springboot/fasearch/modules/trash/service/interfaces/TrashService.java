package com.springboot.fasearch.modules.trash.service.interfaces;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.modules.trash.dto.response.TrashItemRes;
import com.springboot.fasearch.shared.PageResponse;

/** Thùng rác cho dữ liệu nghiệp vụ: chỉ đọc, chỉ khôi phục; không có xóa vĩnh viễn. */
public interface TrashService {

    PageResponse<TrashItemRes> listDeletedProducts(Pageable pageable);

    PageResponse<TrashItemRes> listDeletedVariants(Pageable pageable);

    PageResponse<TrashItemRes> listDeletedCategories(Pageable pageable);

    /** Khách hàng đã xóa mềm; ADMIN và STAFF đều xem được. */
    PageResponse<TrashItemRes> listDeletedCustomers(Pageable pageable);

    /** Hồ sơ nhân sự đã xóa mềm; ADMIN và STAFF đều xem được. */
    PageResponse<TrashItemRes> listDeletedEmployees(Pageable pageable);

    /** Tài khoản đăng nhập đã xóa mềm; chỉ ADMIN. */
    PageResponse<TrashItemRes> listDeletedAccounts(Pageable pageable);

    /** Khôi phục sản phẩm về DISCONTINUED + UNPUBLISHED (không tự bán lại, không tự đẩy AI). */
    void restoreProduct(Long productId);

    void restoreVariant(Long skuId);

    void restoreCategory(Long categoryId);

    /** Khôi phục hồ sơ khách hàng; không mở khóa tài khoản liên kết. */
    void restoreCustomer(Long customerId);

    /** Khôi phục hồ sơ nhân sự; không mở khóa tài khoản liên kết. */
    void restoreEmployee(Long employeeId);

    /** Khôi phục tài khoản về INACTIVE; ADMIN phải bật lại thì mới đăng nhập được. */
    void restoreAccount(Long accountId);
}
