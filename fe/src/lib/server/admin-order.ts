import type { NextRequest } from "next/server";
import { authCookie, requireJsonPost } from "@/lib/server/customer-auth";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { adminIdentity, BE } from "@/lib/server/admin-bff";

const TARGETS = new Set(["CONFIRMED", "PACKING", "SHIPPING", "COMPLETED"]);
const MAX_NOTE = 1000;
const bad = (message: string, status: number, code: string | number) => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });
function mapRefusal(rawMessage: string): string | null {
  const m = (rawMessage || "").trim();
  if (!m) return null;
  if (/Paid orders cannot be cancelled|Đơn đã thu tiền không thể hủy/i.test(m)) return "Đơn đã thanh toán, không thể hủy.";
  if (/Order is already paid|Đơn hàng đã thanh toán/i.test(m)) return "Đơn đã thanh toán, không thể thu thêm.";
  if (/Order is not in a payable state|Đơn hàng không ở trạng thái có thể thanh toán/i.test(m)) return "Đơn không ở trạng thái có thể thu tiền.";
  if (/must be settled through an invoice|COD must be settled|invoice before completion|thu qua hóa đơn|COD phải được thu/i.test(m)) return "Đơn cần ghi nhận thu tiền (hóa đơn) trước khi hoàn tất.";
  if (/S2 financial holds remain committed|Voucher order can no longer be cancelled|Các khoản giữ tài chính S2|Đơn có Voucher không thể hủy/i.test(m)) return "Đơn có voucher/điểm sau bàn giao không thể hủy.";
  if (/Paid amount.*insufficient|không đủ thanh toán|Số tiền thanh toán không đủ/i.test(m)) return "Số tiền thực thu phải ít nhất bằng số tiền còn phải thu.";
  if (/Tổng tiền đơn hàng chưa được ghi nhận/i.test(m)) return "Tổng tiền đơn hàng chưa được ghi nhận, không thể thu tiền mặt.";
  if (/Chỉ ghi nhận thu COD cho đơn đang giao/i.test(m)) return "Chỉ ghi nhận thu COD cho đơn đang giao.";
  if (/^Đơn hàng đã được hủy trước đó/.test(m) && m.length <= 200) return "Đơn hàng đã được hủy trước đó.";
  // Known clear Vietnamese BE messages (order lifecycle) are safe to show verbatim.
  if (/^Đơn hàng đã (bị hủy|hoàn tất|hoàn trả|được trả lại)/.test(m) && m.length <= 200) return m;
  if (/^Không thể chuyển trạng thái/.test(m) && m.length <= 300) return "Không chuyển được trạng thái theo thứ tự cho phép.";
  return null;
}
async function out(upstream: Response): Promise<Response> {
  if (!upstream.ok) {
    let code: string | number = upstream.status;
    let rawMessage = "";
    try {
      const payload = await upstream.json() as { code?: unknown; message?: unknown };
      if (typeof payload.code === "number" || typeof payload.code === "string") code = payload.code;
      if (typeof payload.message === "string") rawMessage = payload.message;
      if (code === 400 && /already paid|Đơn hàng đã thanh toán/i.test(rawMessage)) {
        return bad("Đơn đã thanh toán, không thể thu thêm.", upstream.status, code);
      }
    } catch { /* safe status fallback */ }
    const mapped = mapRefusal(rawMessage);
    if (mapped) return bad(mapped, upstream.status, code);
    const message = upstream.status === 401 ? "Vui lòng đăng nhập lại." : upstream.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : upstream.status === 404 ? "Không tìm thấy đơn hàng." : upstream.status === 409 ? "Đơn hàng đã thay đổi hoặc thao tác không hợp lệ." : upstream.status >= 500 ? "Dịch vụ đơn hàng đang bận." : "Yêu cầu chưa hợp lệ.";
    return bad(message, upstream.status, code);
  }
  const h = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type"); if (type) h.set("content-type", type);
  return new Response(upstream.body, { status: upstream.status, headers: h });
}
async function adminOrderWrite(request: NextRequest, path: string, body: Record<string, unknown>, shippingOrderId?: number): Promise<Response> {
  const guard = requireJsonPost(request);
  if (guard) return new Response(guard.body, { status: guard.status, headers: { "cache-control": "no-store" } });
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return bad("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED");
  try {
    if (shippingOrderId !== undefined) {
      const check = await fetch(`${BE}/api/v1/orders/${shippingOrderId}`, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
      if (!check.ok) return out(check);
      const envelope = await check.json() as { success?: boolean; result?: { status?: unknown } };
      if (!envelope.success || envelope.result?.status !== "SHIPPING") return bad("Chỉ ghi nhận thu COD cho đơn đang giao.", 409, "NOT_ELIGIBLE");
    }
    return await out(await fetch(`${BE}${path}`, { method: "POST", headers: { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) }));
  } catch {
    return bad("Không kết nối được máy chủ đơn hàng.", 503, 503);
  }
}

export function cancelAdminOrder(request: NextRequest, id: number, reason: string): Promise<Response> {
  return adminOrderWrite(request, `/api/v1/orders/${id}/cancel`, { reason });
}

export function recordCashCollection(request: NextRequest, id: number, amountPaid: number, note: string | null): Promise<Response> {
  return adminOrderWrite(request, "/api/v1/payments/process", { orderId: id, paymentMethodCode: "CASH", amountPaid, note }, id);
}

export async function patchOrderStatus(request: NextRequest, id: number): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return new Response(guard.body, { status: guard.status, headers: { "cache-control": "no-store" } });
  const who = await adminIdentity(request); if ("response" in who) return who.response;
  const token = authCookie(request); if (!token) return bad("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED");
  const parsed = await readBoundedJsonObject(request, 4 * 1024); if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu vượt quá giới hạn." : "Dữ liệu chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason);
  const body = parsed.body;
  const status = typeof body.status === "string" ? body.status : "";
  if (!TARGETS.has(status)) return bad("Chỉ được chọn bước kế tiếp hợp lệ của đơn.", 400, "INVALID_TARGET");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > MAX_NOTE) return bad("Ghi chú tối đa 1000 ký tự.", 400, "INVALID_NOTE");
  try {
    return await out(await fetch(`${BE}/api/v1/orders/${id}/status`, {
      method: "PATCH",
      headers: { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    }));
  } catch {
    return bad("Không kết nối được máy chủ đơn hàng.", 503, 503);
  }
}
