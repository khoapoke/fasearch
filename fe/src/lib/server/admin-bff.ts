import type { NextRequest } from "next/server";
import { authCookie, fetchMyInfo } from "@/lib/server/customer-auth";

const BE = "http://127.0.0.1:18112";
type Identity = { role: string; status: string };

function headers(token: string): Record<string, string> {
  return { accept: "application/json", authorization: `Bearer ${token}` };
}

export async function adminIdentity(request: NextRequest): Promise<{ identity: Identity } | { response: Response }> {
  const token = authCookie(request);
  if (!token) return { response: Response.json({ success: false, code: 401, message: "Cần đăng nhập quản trị.", result: null }, { status: 401, headers: { "cache-control": "no-store" } }) };
  try {
    const { response, payload } = await fetchMyInfo(token, request.signal);
    const role = typeof payload?.result?.role === "string" ? payload.result.role : "";
    const status = typeof payload?.result?.status === "string" ? payload.result.status : "";
    if (!response.ok || (role !== "ADMIN" && role !== "STAFF") || status !== "ACTIVE") {
      return { response: Response.json({ success: false, code: 403, message: "Tài khoản không có quyền quản trị.", result: null }, { status: 403, headers: { "cache-control": "no-store" } }) };
    }
    return { identity: { role, status } };
  } catch {
    return { response: Response.json({ success: false, code: 503, message: "Không xác minh được quyền quản trị.", result: null }, { status: 503, headers: { "cache-control": "no-store" } }) };
  }
}

export async function adminRead(request: NextRequest, path: string): Promise<Response> {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401, headers: { "cache-control": "no-store" } });
  try {
    const upstream = await fetch(`${BE}${path}`, { method: "GET", headers: headers(token), cache: "no-store", redirect: "manual", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    const outHeaders = new Headers({ "cache-control": "no-store" });
    const type = upstream.headers.get("content-type"); if (type) outHeaders.set("content-type", type);
    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ đơn hàng.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export function validStatus(raw: string | null): string | null {
  return raw && ["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "COMPLETED", "CANCELLED", "RETURNED"].includes(raw) ? raw : null;
}

export { BE };
