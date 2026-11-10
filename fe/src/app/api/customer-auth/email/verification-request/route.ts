import type { NextRequest } from "next/server";
import { authCookie, authError, requestAborted, requireJsonPost } from "@/lib/server/customer-auth";
import { authBackendUrl } from "@/lib/server/be-upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const token = authCookie(request);
  if (!token) return authError("Cần đăng nhập để gửi lại email xác thực.", 401, "AUTH_REQUIRED");
  try {
    const response = await fetch(`${authBackendUrl()}/api/v1/auth/email/verification-request`, {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
      signal: request.signal,
    });
    let message: string | undefined;
    try { message = ((await response.json()) as { message?: string }).message; } catch { /* non-json */ }
    if (request.signal.aborted) return requestAborted();
    if (response.status === 401 || response.status === 403) {
      return authError("Phiên đăng nhập đã hết. Đăng nhập lại để tiếp tục.", 401, "SESSION_EXPIRED");
    }
    if (response.status === 429) {
      return authError("Bạn thao tác quá nhiều lần. Chờ ít phút rồi thử lại.", 429, "RATE_LIMITED");
    }
    if (!response.ok) {
      return authError(message || "Gửi email xác thực chưa thành công. Thử lại sau.", response.status || 502, "VERIFY_REQUEST_FAILED");
    }
    return Response.json(
      { success: true, message: message || "Email xác thực đã được gửi. Kiểm tra hộp thư (kể cả thư rác)." },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    if (request.signal.aborted) return requestAborted();
    return authError("Không kết nối được máy chủ. Thử lại sau.", 503, "AUTH_UNAVAILABLE");
  }
}
