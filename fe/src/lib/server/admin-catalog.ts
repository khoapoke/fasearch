import type { NextRequest } from "next/server";
import { authCookie, authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity } from "@/lib/server/admin-bff";
const BE = process.env.FASEARCH_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:18126";
function headers(token: string, json = true): Record<string, string> {
  return { accept: json ? "application/json" : "*/*", authorization: `Bearer ${token}` };
}
function responseOf(upstream: Response): Response {
  const out = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type"); if (type) out.set("content-type", type);
  const disposition = upstream.headers.get("content-disposition"); if (disposition) out.set("content-disposition", disposition);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
export async function catalogRead(request: NextRequest, path: string, binary = false): Promise<Response> {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try {
    const upstream = await fetch(`${BE}${path}`, { method: "GET", headers: headers(token, !binary), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    return responseOf(upstream);
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
export async function catalogWrite(request: NextRequest, path: string, method: "POST" | "PATCH" | "PUT", body: unknown): Promise<Response> {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try {
    const upstream = await fetch(`${BE}${path}`, { method, headers: { ...headers(token), "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    return responseOf(upstream);
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
/** Guard codes the BFF may pass through verbatim: their messages are written for staff. */
const STAFF_GUARD_CODES = { min: 4401, max: 4408 };

function deleteRefusalMessage(status: number, code: number, upstream: string | null): { message: string; code: number } {
  if (upstream && code >= STAFF_GUARD_CODES.min && code <= STAFF_GUARD_CODES.max) return { message: upstream, code };
  if (status === 401) return { message: "Phiên quản trị đã hết hạn. Đăng nhập lại rồi thử tiếp.", code: 401 };
  if (status === 403) return { message: "Tài khoản không có quyền xóa dữ liệu này.", code: 403 };
  if (status === 404) return { message: "Không tìm thấy dữ liệu cần xóa. Tải lại danh sách rồi thử tiếp.", code: 404 };
  if (status === 409) return { message: "Dữ liệu đang được dùng ở nơi khác. Tải lại rồi thử tiếp.", code: 409 };
  if (status === 400) return { message: "Yêu cầu xóa chưa hợp lệ.", code: 400 };
  return { message: "Máy chủ chưa xóa được dữ liệu. Thử lại sau.", code: status || 502 };
}

/**
 * Xóa mềm kèm lý do: hộp thoại gửi JSON nên phải qua kiểm tra origin, và thông báo từ chối
 * của guard (4401-4408, viết cho nhân viên) được chuyển nguyên văn; mọi lỗi khác đổi sang
 * câu tiếng Việt, không lộ chuỗi kỹ thuật của BE.
 */
export async function catalogDeleteWithReason(request: NextRequest, path: string): Promise<Response> {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const raw = parsed.body.reason;
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length > 255) return authError("Lý do xóa tối đa 255 ký tự.", 400);
  try {
    const upstream = await fetch(`${BE}${path}`, {
      method: "DELETE",
      headers: { ...headers(token), "content-type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    });
    if (upstream.ok) return responseOf(upstream);
    let payload: { message?: string; code?: number } | null = null;
    try { payload = (await upstream.json()) as { message?: string; code?: number } | null; } catch { payload = null; }
    const mapped = deleteRefusalMessage(upstream.status, Number(payload?.code ?? 0), payload?.message ?? null);
    return Response.json({ success: false, code: mapped.code, message: mapped.message, result: null }, {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function catalogDelete(request: NextRequest, path: string): Promise<Response> {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401, headers: { "cache-control": "no-store" } });
  try {
    const upstream = await fetch(`${BE}${path}`, { method: "DELETE", headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    return responseOf(upstream);
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export function idOf(raw: string): number | null { if (!/^[1-9]\d*$/.test(raw)) return null; const n = Number(raw); return Number.isSafeInteger(n) ? n : null; }
export { BE };
