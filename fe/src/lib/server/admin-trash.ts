import type { NextRequest } from "next/server";
import { authCookie, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity } from "@/lib/server/admin-bff";

const BE = process.env.FASEARCH_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:18126";

/** Guard codes the BFF is allowed to pass through verbatim: they are written for staff. */
const STAFF_MESSAGES = { MIN: 4401, MAX: 4408 };

function headers(token: string): Record<string, string> {
  return { accept: "application/json", authorization: `Bearer ${token}` };
}

function vietnameseFor(status: number, code: number, upstream: string | null): { message: string; code: number } {
  if (code >= STAFF_MESSAGES.MIN && code <= STAFF_MESSAGES.MAX && upstream) {
    return { message: upstream, code };
  }
  if (status === 401) return { message: "Cần đăng nhập quản trị.", code: 401 };
  if (status === 403) return { message: "Tài khoản không có quyền quản trị thùng rác.", code: 403 };
  if (status === 404) return { message: "Không tìm thấy mục này trong thùng rác.", code: 404 };
  if (status === 409) return { message: "Không thể khôi phục vì dữ liệu đang xung đột. Tải lại rồi thử lại.", code: 409 };
  if (status === 400) return { message: "Yêu cầu chưa hợp lệ.", code: 400 };
  return { message: "Máy chủ chưa xử lý được yêu cầu. Thử lại sau.", code: status || 502 };
}

/** Tab tài khoản là quản trị tài khoản: STAFF (Quản lý) không thấy tab và BFF cũng không gọi BE. */
const ADMIN_ONLY_KINDS = new Set(["accounts"]);

function staffRefusedOnAccounts(kind: string, role: string): Response | null {
  if (!ADMIN_ONLY_KINDS.has(kind) || role === "ADMIN") return null;
  return Response.json(
    { success: false, code: 403, message: "Chỉ Quản trị viên hệ thống được xem thùng rác tài khoản đăng nhập.", result: null },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

export async function trashRead(request: NextRequest, kind: string, query: string): Promise<Response> {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const refused = staffRefusedOnAccounts(kind, who.identity.role);
  if (refused) return refused;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try {
    const upstream = await fetch(`${BE}/api/v1/admin/trash/${kind}?${query}`, {
      method: "GET",
      headers: headers(token),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    });
    if (upstream.ok) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { "cache-control": "no-store", "content-type": upstream.headers.get("content-type") ?? "application/json" },
      });
    }
    return Response.json(
      { success: false, message: "Không tải được thùng rác.", code: upstream.status, result: null },
      { status: upstream.status, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function trashRestore(request: NextRequest, kind: string, id: number): Promise<Response> {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const refused = staffRefusedOnAccounts(kind, who.identity.role);
  if (refused) return refused;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try {
    const upstream = await fetch(`${BE}/api/v1/admin/trash/${kind}/${id}/restore`, {
      method: "POST",
      headers: { ...headers(token), "content-type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    });
    let payload: { message?: string; code?: number } | null = null;
    try {
      payload = (await upstream.json()) as { message?: string; code?: number } | null;
    } catch {
      payload = null;
    }
    if (upstream.ok) {
      return Response.json({ success: true, code: 200, result: true, message: payload?.message ?? "Khôi phục thành công" }, {
        headers: { "cache-control": "no-store" },
      });
    }
    const mapped = vietnameseFor(upstream.status, Number(payload?.code ?? 0), payload?.message ?? null);
    return Response.json({ success: false, code: mapped.code, message: mapped.message, result: null }, {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export { BE, vietnameseFor };
