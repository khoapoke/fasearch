import type { NextRequest } from "next/server";
import { authCookie, requireJsonPost } from "@/lib/server/customer-auth";
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
export async function catalogWrite(request: NextRequest, path: string, method: "POST" | "PATCH", body: unknown): Promise<Response> {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  if (who.identity.role !== "ADMIN") return Response.json({ success: false, code: 403, message: "Chỉ ADMIN được sửa catalog.", result: null }, { status: 403 });
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try {
    const upstream = await fetch(`${BE}${path}`, { method, headers: { ...headers(token), "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    return responseOf(upstream);
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
export async function catalogDelete(request: NextRequest, path: string): Promise<Response> {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  if (who.identity.role !== "ADMIN") return Response.json({ success: false, code: 403, message: "Chỉ ADMIN được xóa catalog.", result: null }, { status: 403, headers: { "cache-control": "no-store" } });
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
