package com.springboot.fasearch.modules.trash.service.impl;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.trash.dto.response.TrashItemRes;
import com.springboot.fasearch.modules.trash.repository.TrashRepository;
import com.springboot.fasearch.modules.trash.service.interfaces.TrashService;
import com.springboot.fasearch.security.SecurityUtils;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Thùng rác đọc bằng SQL gốc vì {@code @SQLRestriction} ẩn các dòng đã xóa khỏi JPA.
 * Khôi phục là câu lệnh cập nhật có điều kiện; không có thao tác xóa vĩnh viễn nào.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TrashServiceImpl implements TrashService {

    private static final int MAX_PAGE_SIZE = 100;

    private final TrashRepository trashRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TrashItemRes> listDeletedProducts(Pageable pageable) {
        List<TrashItemRes> items = new ArrayList<>();
        for (Object[] row : trashRepository.findDeletedProducts(offsetOf(pageable), sizeOf(pageable))) {
            items.add(TrashItemRes.builder()
                    .id(asLong(row[0]))
                    .name(asString(row[1]))
                    .status(asString(row[2]))
                    .publicationStatus(asString(row[3]))
                    .deletedAt(asDateTime(row[4]))
                    .deleteReason(asString(row[5]))
                    .deletedBy(asString(row[6]))
                    .build());
        }
        return page(items, pageable, trashRepository.countDeletedProducts());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TrashItemRes> listDeletedVariants(Pageable pageable) {
        List<TrashItemRes> items = new ArrayList<>();
        for (Object[] row : trashRepository.findDeletedVariants(offsetOf(pageable), sizeOf(pageable))) {
            items.add(TrashItemRes.builder()
                    .id(asLong(row[0]))
                    .productId(asLong(row[1]))
                    .productName(asString(row[2]))
                    .name(asString(row[2]))
                    .status(asString(row[3]))
                    .parentDeleted(Boolean.TRUE.equals(row[4]))
                    .color(asString(row[5]))
                    .size(asString(row[6]))
                    .barcode(asString(row[7]))
                    .deletedAt(asDateTime(row[8]))
                    .deleteReason(asString(row[9]))
                    .deletedBy(asString(row[10]))
                    .build());
        }
        return page(items, pageable, trashRepository.countDeletedVariants());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TrashItemRes> listDeletedCategories(Pageable pageable) {
        List<TrashItemRes> items = new ArrayList<>();
        for (Object[] row : trashRepository.findDeletedCategories(offsetOf(pageable), sizeOf(pageable))) {
            items.add(TrashItemRes.builder()
                    .id(asLong(row[0]))
                    .name(asString(row[1]))
                    .deletedAt(asDateTime(row[2]))
                    .deleteReason(asString(row[3]))
                    .deletedBy(asString(row[4]))
                    .build());
        }
        return page(items, pageable, trashRepository.countDeletedCategories());
    }

    @Override
    @Transactional
    public void restoreProduct(Long productId) {
        if (trashRepository.countDeletedProduct(productId) == 0) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND, "Không tìm thấy sản phẩm này trong thùng rác.");
        }
        if (trashRepository.countSameBrandModelProducts(productId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục: đã có sản phẩm khác cùng thương hiệu và mã model. Hãy đổi mã model của sản phẩm mới trước.");
        }
        long barcodeConflicts = trashRepository.countVariantBarcodeConflictsInProduct(productId);
        if (barcodeConflicts > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục: " + barcodeConflicts
                            + " mã vạch của sản phẩm này đang được một SKU khác sử dụng. Hãy đổi mã vạch SKU kia trước.");
        }

        // Only SKUs deleted in the same batch as the product (identical deletion timestamp stamped at
        // delete time) come back; SKUs deleted separately earlier stay in the trash. This runs before
        // the product row is cleared because the batch is matched on the product's stored timestamp.
        int variants = trashRepository.restoreVariantsOfProduct(productId);
        if (trashRepository.restoreProduct(productId) != 1) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND, "Không tìm thấy sản phẩm này trong thùng rác.");
        }
        log.info("Restored product ID [{}] (DISCONTINUED/UNPUBLISHED) with {} variant(s)", productId, variants);
    }

    @Override
    @Transactional
    public void restoreVariant(Long skuId) {
        if (trashRepository.countDeletedVariant(skuId) == 0) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND, "Không tìm thấy SKU này trong thùng rác.");
        }
        if (trashRepository.countDeletedProductOfVariant(skuId) > 0) {
            throw new AppException(ErrorCode.RESTORE_BLOCKED,
                    "Không thể khôi phục SKU vì sản phẩm của SKU đang ở trong thùng rác. Hãy khôi phục sản phẩm trước.");
        }
        if (trashRepository.countVariantBarcodeConflicts(skuId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục SKU: mã vạch này đang được một SKU khác sử dụng.");
        }
        if (trashRepository.countVariantSiblingConflicts(skuId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục SKU: sản phẩm đã có SKU khác cùng màu và kích cỡ.");
        }
        if (trashRepository.restoreVariant(skuId) != 1) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND, "Không tìm thấy SKU này trong thùng rác.");
        }
        log.info("Restored variant ID [{}]", skuId);
    }

    @Override
    @Transactional
    public void restoreCategory(Long categoryId) {
        if (trashRepository.countDeletedCategory(categoryId) == 0) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND, "Không tìm thấy danh mục này trong thùng rác.");
        }
        if (trashRepository.countCategoryNameConflicts(categoryId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục: tên danh mục này đã được một danh mục khác sử dụng. Hãy đổi tên danh mục kia trước.");
        }
        if (trashRepository.restoreCategory(categoryId) != 1) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND, "Không tìm thấy danh mục này trong thùng rác.");
        }
        log.info("Restored category ID [{}]", categoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TrashItemRes> listDeletedCustomers(Pageable pageable) {
        List<TrashItemRes> items = new ArrayList<>();
        for (Object[] row : trashRepository.findDeletedCustomers(offsetOf(pageable), sizeOf(pageable))) {
            items.add(TrashItemRes.builder()
                    .id(asLong(row[0]))
                    .name(joinName(row[1], row[2]))
                    .phone(asString(row[3]))
                    .deletedAt(asDateTime(row[4]))
                    .deleteReason(asString(row[5]))
                    .deletedBy(asString(row[6]))
                    .linkedUsername(asString(row[7]))
                    .linkedAccountStatus(asString(row[8]))
                    .build());
        }
        return page(items, pageable, trashRepository.countDeletedCustomers());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TrashItemRes> listDeletedEmployees(Pageable pageable) {
        List<TrashItemRes> items = new ArrayList<>();
        for (Object[] row : trashRepository.findDeletedEmployees(offsetOf(pageable), sizeOf(pageable))) {
            items.add(TrashItemRes.builder()
                    .id(asLong(row[0]))
                    .name(joinName(row[1], row[2]))
                    .phone(asString(row[3]))
                    .deletedAt(asDateTime(row[4]))
                    .deleteReason(asString(row[5]))
                    .deletedBy(asString(row[6]))
                    .linkedUsername(asString(row[7]))
                    .linkedAccountStatus(asString(row[8]))
                    .build());
        }
        return page(items, pageable, trashRepository.countDeletedEmployees());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TrashItemRes> listDeletedAccounts(Pageable pageable) {
        List<TrashItemRes> items = new ArrayList<>();
        for (Object[] row : trashRepository.findDeletedAccounts(offsetOf(pageable), sizeOf(pageable))) {
            items.add(TrashItemRes.builder()
                    .id(asLong(row[0]))
                    .name(asString(row[1]))
                    .email(asString(row[2]))
                    .role(asString(row[3]))
                    .status(asString(row[4]))
                    .deletedAt(asDateTime(row[5]))
                    .deleteReason(asString(row[6]))
                    .deletedBy(asString(row[7]))
                    .build());
        }
        return page(items, pageable, trashRepository.countDeletedAccounts());
    }

    @Override
    @Transactional
    public void restoreCustomer(Long customerId) {
        if (trashRepository.countDeletedCustomer(customerId) == 0) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND,
                    "Không tìm thấy khách hàng này trong thùng rác.");
        }
        if (trashRepository.countDeletedAccountOfCustomer(customerId) > 0) {
            throw new AppException(ErrorCode.RESTORE_BLOCKED,
                    "Không thể khôi phục khách hàng vì tài khoản đăng nhập liên kết đang ở trong thùng rác. Hãy khôi phục tài khoản trước.");
        }
        if (trashRepository.countCustomerPhoneConflicts(customerId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục khách hàng: số điện thoại của hồ sơ đã được một khách hàng khác sử dụng.");
        }
        if (trashRepository.restoreCustomer(customerId) != 1) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND,
                    "Không tìm thấy khách hàng này trong thùng rác.");
        }
        log.info("Restored customer ID [{}]", customerId);
    }

    @Override
    @Transactional
    public void restoreEmployee(Long employeeId) {
        if (trashRepository.countDeletedEmployee(employeeId) == 0) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND,
                    "Không tìm thấy hồ sơ nhân sự này trong thùng rác.");
        }
        // Quản lý không được xóa hay sửa hồ sơ của Quản trị viên, nên cũng không được khôi phục hồ sơ đó.
        if (!SecurityUtils.hasRole(RoleType.ADMIN.name()) && trashRepository.countAdminLinkedEmployee(employeeId) > 0) {
            throw new AppException(ErrorCode.ACCESS_DENIED,
                    "Chỉ Quản trị viên hệ thống được khôi phục hồ sơ của Quản trị viên.");
        }
        if (trashRepository.countDeletedAccountOfEmployee(employeeId) > 0) {
            throw new AppException(ErrorCode.RESTORE_BLOCKED,
                    "Không thể khôi phục hồ sơ nhân sự vì tài khoản đăng nhập liên kết đang ở trong thùng rác. Hãy khôi phục tài khoản trước.");
        }
        if (trashRepository.countEmployeePhoneConflicts(employeeId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục hồ sơ nhân sự: số điện thoại đã được một hồ sơ khác sử dụng.");
        }
        if (trashRepository.countEmployeeCccdConflicts(employeeId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục hồ sơ nhân sự: số CCCD đã được một hồ sơ khác sử dụng.");
        }
        if (trashRepository.restoreEmployee(employeeId) != 1) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND,
                    "Không tìm thấy hồ sơ nhân sự này trong thùng rác.");
        }
        // Khôi phục hồ sơ KHÔNG mở khóa tài khoản đăng nhập: tài khoản bị khóa khi xóa vẫn khóa,
        // ADMIN quyết định mở khóa ở màn hình tài khoản.
        log.info("Restored employee ID [{}] without unlocking any linked account", employeeId);
    }

    @Override
    @Transactional
    public void restoreAccount(Long accountId) {
        if (trashRepository.countDeletedAccount(accountId) == 0) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND,
                    "Không tìm thấy tài khoản này trong thùng rác.");
        }
        long liveProfiles = trashRepository.countLiveEmployeeProfilesForAccount(accountId)
                + trashRepository.countLiveCustomerProfilesForAccount(accountId);
        if (liveProfiles > 0) {
            throw new AppException(ErrorCode.RESTORE_BLOCKED,
                    "Không thể khôi phục tài khoản vì còn " + liveProfiles
                            + " hồ sơ nhân sự hoặc khách hàng đang hoạt động liên kết.");
        }
        if (trashRepository.countAccountUsernameConflicts(accountId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục tài khoản: tên đăng nhập đã được một tài khoản khác sử dụng.");
        }
        if (trashRepository.countAccountEmailConflicts(accountId) > 0) {
            throw new AppException(ErrorCode.RESTORE_CONFLICT,
                    "Không thể khôi phục tài khoản: email đã được một tài khoản khác sử dụng.");
        }
        if (trashRepository.restoreAccount(accountId) != 1) {
            throw new AppException(ErrorCode.TRASH_ITEM_NOT_FOUND,
                    "Không tìm thấy tài khoản này trong thùng rác.");
        }
        log.info("Restored account ID [{}] as INACTIVE", accountId);
    }

    private static int sizeOf(Pageable pageable) {
        return Math.max(1, Math.min(MAX_PAGE_SIZE, pageable.getPageSize()));
    }

    private static int offsetOf(Pageable pageable) {
        return pageable.getPageNumber() * sizeOf(pageable);
    }

    private static PageResponse<TrashItemRes> page(List<TrashItemRes> items, Pageable pageable, long total) {
        int size = sizeOf(pageable);
        int totalPages = (int) Math.ceil(total / (double) size);
        long seen = (long) offsetOf(pageable) + items.size();
        return PageResponse.<TrashItemRes>builder()
                .content(items)
                .pageNumber(pageable.getPageNumber())
                .pageSize(size)
                .totalElements(total)
                .totalPages(totalPages)
                .isLast(seen >= total)
                .build();
    }

    private static Long asLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    /** Ghép họ và tên như danh sách khách hàng/nhân sự; hồ sơ không có tên trả null thay vì chuỗi rỗng. */
    private static String joinName(Object first, Object last) {
        String joined = ((first == null ? "" : first.toString().trim()) + " "
                + (last == null ? "" : last.toString().trim())).trim();
        return joined.isEmpty() ? null : joined;
    }

    private static LocalDateTime asDateTime(Object value) {
        if (value instanceof LocalDateTime dateTime) {
            return dateTime;
        }
        if (value instanceof java.sql.Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        return null;
    }
}
