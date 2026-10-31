import type { NextRequest } from "next/server";
import { authCookie, requireJsonPost } from "@/lib/server/customer-auth";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { adminIdentity, BE } from "@/lib/server/admin-bff";

const TARGETS = new Set(["CONFIRMED", "PACKING", "SHIPPING", "COMPLETED"]);
const MAX_NOTE = 1000;
const bad = (message: string, status: number, code: string | number) => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });
async function out(upstream: Response): Promise<Response> {
  if (!upstream.ok) {
    let code: string | number = upstream.status;
    try { const payload = await upstream.json() as { code?: unknown }; if (typeof payload.code === "number" || typeof payload.code === "string") code = payload.code; } catch { /* safe status fallback */ }
    const message = upstream.status === 401 ? "Vui lòng đăng nhập lại." : upstream.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : upstream.status === 404 ? "Không tìm thấy đơn hàng." : upstream.status === 409 ? "Đơn hàng đã thay đổi hoặc thao tác không hợp lệ." : upstream.status >= 500 ? "Dịch vụ đơn hàng đang bận." : "Yêu cầu chưa hợp lệ.";
    return bad(message, upstream.status, code);
  }
  const h = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type"); if (type) h.set("content-type", type);
  return new Response(upstream.body, { status: upstream.status, headers: h });
}
async function adminOrderWrite(request: NextRequest, path: string, body: Record<string, unknown>, voucherOrderId?: number): Promise<Response> {
  const guard = requireJsonPost(request);
  if (guard) return new Response(guard.body, { status: guard.status, headers: { "cache-control": "no-store" } });
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return bad("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED");
  try {
    if (voucherOrderId !== undefined) {
      const check = await fetch(`${BE}/api/v1/orders/${voucherOrderId}`, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
      if (!check.ok) return out(check);
      const envelope = await check.json() as { success?: boolean; result?: { voucherCode?: unknown; status?: unknown } };
      if (!envelope.success || typeof envelope.result?.voucherCode !== "string" || envelope.result.status !== "SHIPPING") return bad("Chỉ ghi nhận thu COD cho đơn voucher đang giao.", 409, "NOT_ELIGIBLE");
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
