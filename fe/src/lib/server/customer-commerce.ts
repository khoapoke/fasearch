import type { NextRequest } from "next/server";
import { authCookie } from "@/lib/server/customer-auth";

// Narrow same-origin commerce transport. The JWT stays server-side and is sent
// as Bearer only to the fixed candidate BE; no legacy session/cookie fallback.
const COMMERCE_BASE = "http://127.0.0.1:18122";

function timeoutSignal(signal: AbortSignal): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(12000)]);
}

export async function commerceUpstream(
  request: NextRequest,
  path: string,
  init: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = { method: "GET" },
): Promise<Response> {
  const token = authCookie(request);
  if (!token) {
    return Response.json({ success: false, code: 401, message: "Cần đăng nhập để dùng giỏ hàng.", result: null }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  let upstream: Response;
  try {
    upstream = await fetch(`${COMMERCE_BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      redirect: "manual",
      signal: timeoutSignal(request.signal),
    });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ giỏ hàng.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const out = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export function commerceId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
