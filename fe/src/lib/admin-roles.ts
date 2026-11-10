/** Quản trị viên (ADMIN) và Quản lý (STAFF) là hai vai trò nội bộ; chỉ tài khoản/vai trò là ADMIN. */
export const canManage = (role: string | null): boolean => role === "ADMIN" || role === "STAFF";

/**
 * Mã quyền nghiệp vụ (khớp `security/Permission.java` ở BE). ADMIN luôn có mọi quyền; Quản lý có các quyền
 * Quản trị viên bật trong "Vai trò & quyền". FE chỉ dùng để ẩn/hiện; BE luôn kiểm tra lại từng yêu cầu.
 */
export type PermissionCode =
  | "RETURN_VIEW" | "RETURN_PROCESS" | "RETURN_REFUND"
  | "ORDER_VIEW" | "ORDER_UPDATE_STATUS" | "ORDER_CANCEL" | "ORDER_COLLECT_CASH" | "POS_USE"
  | "CUSTOMER_VIEW" | "CUSTOMER_CREATE" | "CUSTOMER_EDIT" | "CUSTOMER_DELETE"
  | "EMPLOYEE_VIEW" | "EMPLOYEE_CREATE" | "EMPLOYEE_EDIT" | "EMPLOYEE_DELETE"
  | "PRODUCT_VIEW" | "PRODUCT_EDIT" | "PRODUCT_DELETE" | "PRODUCT_PUBLISH" | "PRODUCT_IMPORT" | "CATEGORY_MANAGE" | "REVIEW_MODERATE"
  | "INVENTORY_VIEW" | "INVENTORY_RECEIPT_CREATE" | "STOCKTAKE_CREATE"
  | "PROMOTION_VIEW" | "PROMOTION_MANAGE"
  | "LOYALTY_POLICY_VIEW" | "LOYALTY_POLICY_MANAGE" | "LOYALTY_ADJUST"
  | "AUDIT_VIEW" | "REPORT_VIEW" | "DATA_EXPORT"
  | "TRASH_VIEW" | "TRASH_RESTORE";

/** Quyền hiệu lực: ADMIN luôn đúng; Quản lý theo danh sách my-info; vai trò khác luôn sai. */
export function hasPermission(role: string | null, permissions: readonly string[] | null | undefined, code: PermissionCode): boolean {
  if (role === "ADMIN") return true;
  if (role !== "STAFF") return false;
  return Array.isArray(permissions) && permissions.includes(code);
}

/**
 * Quyền cần để mở một trang quản trị (khớp tiền tố dài nhất). null = mọi tài khoản nội bộ.
 * Tài khoản nội bộ (`/quan-tri/tai-khoan-noi-bo`) là ADMIN-only và được khung chặn riêng.
 */
const ROUTE_PERMISSIONS: Array<{ pattern: RegExp; perm: PermissionCode }> = [
  { pattern: /^\/quan-tri\/nhat-ky(\/|$)/, perm: "AUDIT_VIEW" },
  { pattern: /^\/quan-tri\/doi-tra(\/|$)/, perm: "RETURN_VIEW" },
  { pattern: /^\/quan-tri\/don-hang(\/|$)/, perm: "ORDER_VIEW" },
  { pattern: /^\/quan-tri\/khach-hang\/moi(\/|$)/, perm: "CUSTOMER_CREATE" },
  { pattern: /^\/quan-tri\/khach-hang(\/|$)/, perm: "CUSTOMER_VIEW" },
  { pattern: /^\/quan-tri\/khuyen-mai(\/|$)/, perm: "PROMOTION_VIEW" },
  { pattern: /^\/quan-tri\/chinh-sach-diem(\/|$)/, perm: "LOYALTY_POLICY_VIEW" },
  { pattern: /^\/quan-tri\/san-pham\/new(\/|$)/, perm: "PRODUCT_EDIT" },
  { pattern: /^\/quan-tri\/san-pham\/[^/]+\/sua(\/|$)/, perm: "PRODUCT_EDIT" },
  { pattern: /^\/quan-tri\/san-pham\/nhap-csv(\/|$)/, perm: "PRODUCT_IMPORT" },
  { pattern: /^\/quan-tri\/san-pham\/nhap(\/|$)/, perm: "PRODUCT_EDIT" },
  { pattern: /^\/quan-tri\/san-pham(\/|$)/, perm: "PRODUCT_VIEW" },
  { pattern: /^\/quan-tri\/danh-muc(\/|$)/, perm: "PRODUCT_VIEW" },
  { pattern: /^\/quan-tri\/in-tem(\/|$)/, perm: "PRODUCT_VIEW" },
  { pattern: /^\/quan-tri\/(phieu-nhap|phieu-xuat)\/moi(\/|$)/, perm: "INVENTORY_RECEIPT_CREATE" },
  { pattern: /^\/quan-tri\/kiem-ke\/moi(\/|$)/, perm: "STOCKTAKE_CREATE" },
  { pattern: /^\/quan-tri\/(ton-kho|phieu-nhap|phieu-xuat|kiem-ke)(\/|$)/, perm: "INVENTORY_VIEW" },
  { pattern: /^\/quan-tri\/bao-cao(\/|$)/, perm: "REPORT_VIEW" },
  { pattern: /^\/quan-tri\/nhan-vien\/moi(\/|$)/, perm: "EMPLOYEE_CREATE" },
  { pattern: /^\/quan-tri\/nhan-vien(\/|$)/, perm: "EMPLOYEE_VIEW" },
  { pattern: /^\/quan-tri\/thung-rac(\/|$)/, perm: "TRASH_VIEW" },
];

export function routePermission(pathname: string): PermissionCode | null {
  for (const rule of ROUTE_PERMISSIONS) if (rule.pattern.test(pathname)) return rule.perm;
  return null;
}
