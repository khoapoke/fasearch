package com.springboot.fasearch.security;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Danh mục quyền nghiệp vụ có thể bật/tắt cho vai trò Quản lý (STAFF).
 *
 * <p>Quy tắc:
 * <ul>
 *   <li>Quản trị viên (ADMIN) luôn có MỌI quyền trong danh mục này (không lưu, không sửa được).</li>
 *   <li>Quản lý (STAFF) có đúng các quyền được bật trong bảng {@code quyen_vai_tro}; mã lạ trong bảng bị bỏ qua.</li>
 *   <li>Khách hàng (CUSTOMER) không có quyền nào ở đây.</li>
 *   <li>Quản lý tài khoản/vai trò, sửa phân quyền, tab tài khoản trong thùng rác và mở số dư điểm cũ
 *       KHÔNG nằm trong danh mục: luôn chỉ dành cho ADMIN.</li>
 * </ul>
 * Mỗi quyền thành một authority {@code PERM_<mã>} (xem {@link #authority()}), kiểm tra bằng
 * {@code @PreAuthorize("hasAuthority('PERM_...')")}.
 */
public enum Permission {

    // Đơn hàng
    ORDER_VIEW("ORDERS", "Xem đơn hàng"),
    ORDER_UPDATE_STATUS("ORDERS", "Chuyển trạng thái đơn"),
    ORDER_CANCEL("ORDERS", "Hủy đơn"),
    ORDER_COLLECT_CASH("ORDERS", "Ghi nhận thu tiền COD"),
    POS_USE("ORDERS", "Bán tại quầy (POS)"),

    RETURN_VIEW("ORDERS", "Xem đổi/trả"),
    RETURN_PROCESS("ORDERS", "Duyệt và nhận hàng trả"),
    RETURN_REFUND("ORDERS", "Hoàn tiền đổi/trả"),

    // Khách hàng
    CUSTOMER_VIEW("CUSTOMERS", "Xem khách hàng"),
    CUSTOMER_CREATE("CUSTOMERS", "Thêm khách hàng"),
    CUSTOMER_EDIT("CUSTOMERS", "Sửa khách hàng"),
    CUSTOMER_DELETE("CUSTOMERS", "Xóa khách hàng"),

    // Nhân sự
    EMPLOYEE_VIEW("EMPLOYEES", "Xem hồ sơ nhân sự"),
    EMPLOYEE_CREATE("EMPLOYEES", "Thêm hồ sơ nhân sự"),
    EMPLOYEE_EDIT("EMPLOYEES", "Sửa hồ sơ nhân sự"),
    EMPLOYEE_DELETE("EMPLOYEES", "Xóa hồ sơ nhân sự"),

    // Sản phẩm
    PRODUCT_VIEW("PRODUCTS", "Xem sản phẩm, Draft và Barcode"),
    PRODUCT_EDIT("PRODUCTS", "Thêm, sửa sản phẩm, SKU, ảnh và Draft"),
    PRODUCT_DELETE("PRODUCTS", "Xóa sản phẩm và SKU"),
    PRODUCT_PUBLISH("PRODUCTS", "Publish, Unpublish và đồng bộ AI search"),
    PRODUCT_IMPORT("PRODUCTS", "Import sản phẩm (CSV, đường dẫn)"),
    CATEGORY_MANAGE("PRODUCTS", "Thêm, sửa, xóa danh mục"),
    REVIEW_MODERATE("PRODUCTS", "Xem và ẩn/hiện đánh giá"),

    // Kho
    INVENTORY_VIEW("INVENTORY", "Xem tồn kho, phiếu và kiểm kê"),
    INVENTORY_RECEIPT_CREATE("INVENTORY", "Tạo phiếu nhập, phiếu xuất"),
    STOCKTAKE_CREATE("INVENTORY", "Tạo phiếu kiểm kê"),

    // Khuyến mãi
    PROMOTION_VIEW("PROMOTIONS", "Xem khuyến mãi"),
    PROMOTION_MANAGE("PROMOTIONS", "Tạo, sửa khuyến mãi và Voucher"),

    // Điểm
    LOYALTY_POLICY_VIEW("LOYALTY", "Xem chính sách điểm và hạng"),
    LOYALTY_POLICY_MANAGE("LOYALTY", "Sửa chính sách điểm và hạng"),
    LOYALTY_ADJUST("LOYALTY", "Điều chỉnh điểm và tính lại điểm cho đơn"),

    AUDIT_VIEW("REPORTS", "Xem nhật ký hoạt động"),

    // Report
    REPORT_VIEW("REPORTS", "Xem Report"),
    DATA_EXPORT("REPORTS", "Export CSV"),

    // Thùng rác
    TRASH_VIEW("TRASH", "Xem thùng rác"),
    TRASH_RESTORE("TRASH", "Khôi phục từ thùng rác");

    public static final String AUTHORITY_PREFIX = "PERM_";

    /** Nhóm hiển thị theo thứ tự trong màn hình phân quyền. */
    public enum Group {
        ORDERS("Đơn hàng"),
        CUSTOMERS("Khách hàng"),
        EMPLOYEES("Nhân sự"),
        PRODUCTS("Sản phẩm"),
        INVENTORY("Kho"),
        PROMOTIONS("Khuyến mãi"),
        LOYALTY("Điểm"),
        REPORTS("Report"),
        TRASH("Thùng rác");

        private final String label;

        Group(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    /**
     * Quyền MỚI mặc định tắt cho Quản lý khi migration seed (V27). Mọi quyền còn lại được seed bật
     * để Quản lý giữ đúng phạm vi trước khi có phân quyền.
     */
    public static final Set<Permission> OFF_BY_DEFAULT_FOR_STAFF = Collections.unmodifiableSet(
            new LinkedHashSet<>(List.of(LOYALTY_ADJUST, RETURN_REFUND, AUDIT_VIEW)));

    private final Group group;
    private final String label;

    Permission(String group, String label) {
        this.group = Group.valueOf(group);
        this.label = label;
    }

    public Group group() {
        return group;
    }

    public String label() {
        return label;
    }

    public String authority() {
        return AUTHORITY_PREFIX + name();
    }

    public static Optional<Permission> fromCode(String code) {
        if (code == null) {
            return Optional.empty();
        }
        for (Permission p : values()) {
            if (p.name().equals(code)) {
                return Optional.of(p);
            }
        }
        return Optional.empty();
    }

    /** Bộ quyền mặc định của Quản lý (khớp seed V27). */
    public static Set<Permission> staffDefaults() {
        return Arrays.stream(values())
                .filter(p -> !OFF_BY_DEFAULT_FOR_STAFF.contains(p))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
