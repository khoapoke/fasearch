import type { NextRequest } from "next/server";
import { authError, readJsonObject, requestAborted, requireJsonPost } from "@/lib/server/customer-auth";
import { authBackendUrl } from "@/lib/server/be-upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const token = typeof parsed.body.token === "string" ? parsed.body.token.trim() : "";
  if (!token) return authError("Liên kết xác thực không hợp lệ.", 400, "INVALID_REQUEST");
  try {
    const response = await fetch(`${authBackendUrl()}/api/v1/auth/email/verify`, {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: request.signal,
    });
    let message: string | undefined;
    try { message = ((await response.json()) as { message?: string }).message; } catch { /* non-json */ }
    if (request.signal.aborted) return requestAborted();
    if (response.status === 429) {
      return authError("Bạn thao tác quá nhiều lần. Chờ ít phút rồi thử lại.", 429, "RATE_LIMITED");
    }
    if (response.status === 400) {
      return authError(message || "Liên kết không hợp lệ hoặc đã hết hạn.", 400, "INVALID_TOKEN");
    }
    if (!response.ok) {
      return authError(message || "Xác thực email chưa thành công. Thử lại sau.", response.status || 502, "VERIFY_FAILED");
    }
    return Response.json(
      { success: true, message: message || "Xác thực email thành công." },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    if (request.signal.aborted) return requestAborted();
    return authError("Không kết nối được máy chủ. Thử lại sau.", 503, "AUTH_UNAVAILABLE");
  }
}
