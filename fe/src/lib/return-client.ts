export const returnStatuses: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Đã từ chối", CANCELLED: "Đã hủy", RECEIVED: "Đã nhận hàng", REFUNDED: "Đã hoàn tiền" };
export const returnReasons: Record<string, string> = { WRONG_SIZE: "Sai size", DEFECTIVE: "Lỗi sản phẩm", NOT_AS_DESCRIBED: "Không giống mô tả", CHANGE_MIND: "Đổi ý", OTHER: "Khác" };
export type ReturnLine = { skuId: number; productName: string; variantName: string; quantity: number; grossAmount: number; voucherDiscount: number; pointsDiscount: number; refundAmount: number; restockQuantity: number | null };
export type ReturnDetail = { id: number; orderId: number; orderCode: string; customerName: string; customerPhone: string | null; status: string; reason: string; note: string | null; rejectionReason: string | null; cancelReason: string | null; paidAmount: number; orderRefundedAmount: number; refundAttempts?: { number: number; refundId: string | null; status: string }[]; createdAt: string; merchandiseAmount: number; shippingAmount: number; refundAmount: number; refundMethod: string; refundId: string | null; refundActor?: string | null; refundNote?: string | null; earnedReverse: number; redeemedReturn: number; pointsShortfall: number; lines: ReturnLine[]; photos: number[]; history: { status: string; actor?: string; note: string | null; occurredAt: string }[] };
export type CustomerReturns = { eligible: boolean; windowDays: number; completedAt: string; partiallyReturned: boolean; paidAmount: number; refundedAmount: number; lines: { skuId: number; quantity: number; remaining: number }[]; requests: ReturnDetail[] };
export async function returnApi<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal });
  const payload = await res.json();
  if (!res.ok || payload.success === false) throw new Error(payload.message || "Không xử lý được yêu cầu đổi/trả.");
  return payload.result as T;
}
export const returnMoney = (n: number) => `${n.toLocaleString("vi-VN")} đ`;

export function refundMethodLabel(method: string | null | undefined): string {
  return method === "STRIPE" ? "Stripe (tự động)" : "Hoàn thủ công qua cửa hàng";
}
export function returnActionError(action: string, note: string, method?: string): string {
  if (action === "reject" && !note.trim()) return "Vui lòng nhập lý do từ chối.";
  if (action === "cancel" && !note.trim()) return "Vui lòng nhập lý do hủy yêu cầu.";
  if (action === "refund" && method !== "STRIPE" && !note.trim()) return "Vui lòng ghi chú chứng từ hoàn tiền thủ công.";
  return "";
}
export function refundStatus(refunded: number, paid: number): string {
  return refunded > 0 ? refunded < paid ? "Đã hoàn một phần" : "Đã hoàn tiền" : "Đã thanh toán";
}
