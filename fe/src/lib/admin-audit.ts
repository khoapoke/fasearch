export const auditObjects: Record<string, string> = {
  PRODUCT: "Sản phẩm", SKU: "SKU", CATEGORY: "Danh mục", ORDER: "Đơn hàng", INVOICE: "Hóa đơn", PAYMENT: "Thu tiền",
  RETURN: "Đổi/trả", RETURN_LINE: "Hàng trả", IMPORT_RECEIPT: "Phiếu nhập", EXPORT_RECEIPT: "Phiếu xuất", STOCKTAKE: "Kiểm kê",
  STOCK: "Tồn kho", IMPORT_LINE: "Chi tiết nhập", EXPORT_LINE: "Chi tiết xuất", STOCKTAKE_LINE: "Chi tiết kiểm kê",
  PROMOTION: "Khuyến mãi", VOUCHER: "Voucher", LOYALTY_POLICY: "Chính sách điểm", LOYALTY_POLICY_VERSION: "Phiên bản điểm",
  LOYALTY_TIER: "Hạng thành viên", PROMOTION_PRODUCT: "Phạm vi khuyến mãi",
  LOYALTY_ENTRY: "Giao dịch điểm", CUSTOMER: "Khách hàng", EMPLOYEE: "Nhân sự", ACCOUNT: "Tài khoản", PERMISSION: "Phân quyền",
};
export const auditActions: Record<string, string> = {
  CREATE: "Tạo mới", UPDATE: "Cập nhật", DELETE: "Xóa", RESTORE: "Khôi phục", STATUS_CHANGE: "Đổi trạng thái",
  REFUND: "Hoàn tiền", POINT_ADJUST: "Điều chỉnh điểm", PERMISSION_CHANGE: "Đổi quyền",
};
export type AuditEntry = { id: number; occurredAt: string; actorId: number | null; actorUsername: string; actorRole: string; action: string; objectType: string; objectId: string; objectLabel: string; changes: Record<string, { before: unknown; after: unknown }> };
export type AuditPage = { content: AuditEntry[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; isLast: boolean };
export type AuditFilters = { from: string; to: string; actor: string; objectType: string; action: string; q: string };
export function auditQuery(filters: AuditFilters): string {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])).toString();
}
export async function auditRead<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/admin/audit${path}`, { cache: "no-store", signal });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || "Không tải được nhật ký hoạt động.");
  return payload.result as T;
}
