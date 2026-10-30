import type { NextRequest } from "next/server";
import { authCookie, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity } from "@/lib/server/admin-bff";
const BE = "http://127.0.0.1:18118";
function headers(token: string, json = true): Record<string, string> { return { accept: json ? "application/json" : "*/*", authorization: `Bearer ${token}` }; }
function out(up: Response): Response { const h = new Headers({ "cache-control": "no-store" }); const t = up.headers.get("content-type"); if (t) h.set("content-type", t); return new Response(up.body, { status: up.status, headers: h }); }
export async function stockRead(request: NextRequest, path: string): Promise<Response> {
  const who = await adminIdentity(request); if ("response" in who) return who.response;
  const token = authCookie(request); if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try { return out(await fetch(`${BE}${path}`, { method: "GET", headers: headers(token), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) })); }
  catch { return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ tồn kho.", result: null }, { status: 503, headers: { "cache-control": "no-store" } }); }
}
export async function stockWrite(request: NextRequest, path: string, body: unknown): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard;
  const who = await adminIdentity(request); if ("response" in who) return who.response;
  if (who.identity.role !== "ADMIN") return Response.json({ success: false, code: 403, message: "Chỉ ADMIN được tạo phiếu nhập.", result: null }, { status: 403 });
  const token = authCookie(request); if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try { return out(await fetch(`${BE}${path}`, { method: "POST", headers: { ...headers(token), "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) })); }
  catch { return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ tồn kho.", result: null }, { status: 503, headers: { "cache-control": "no-store" } }); }
}
export function positiveId(raw: string): number | null { if (!/^[1-9]\d*$/.test(raw)) return null; const n = Number(raw); return Number.isSafeInteger(n) ? n : null; }
export { BE };
