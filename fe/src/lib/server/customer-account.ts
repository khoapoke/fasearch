import type { NextRequest } from "next/server";
import { authCookie } from "@/lib/server/customer-auth";
import { authBackendUrl } from "@/lib/server/be-upstream";

// Narrow same-origin account transport for STT6 P1 (search history + favorites).
// JWT stays server-side; Bearer only to the paired BE; no legacy session fallback.
function timeoutSignal(signal: AbortSignal): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(12000)]);
}

export async function accountUpstream(
  request: NextRequest,
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown } = { method: "GET" },
): Promise<Response> {
  const token = authCookie(request);
  if (!token) {
    return Response.json({ success: false, code: 401, message: "Cần đăng nhập để dùng tài khoản.", result: null }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  let upstream: Response;
  try {
    upstream = await fetch(`${authBackendUrl()}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      redirect: "manual",
      signal: timeoutSignal(request.signal),
    });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ tài khoản.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const outHeaders = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) outHeaders.set("content-type", type);
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: outHeaders });
}
