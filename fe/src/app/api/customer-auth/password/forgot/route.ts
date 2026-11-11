import type { NextRequest } from "next/server";
import { authError, readJsonObject, requestAborted, requireJsonPost } from "@/lib/server/customer-auth";
import { authBackendUrl } from "@/lib/server/be-upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GENERIC_SUCCESS = "Nếu email đã đăng ký, liên kết đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư (kể cả thư rác).";

// Public: khong yeu cau attempt cookie (quen mat khau dung duoc ngay ca khi chua co phien).
export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const email = typeof parsed.body.email === "string" ? parsed.body.email.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return authError("Nhập địa chỉ email đúng định dạng.", 400, "INVALID_REQUEST");
  }
  try {
    const response = await fetch(`${authBackendUrl()}/api/v1/auth/password/forgot`, {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ email }),
      signal: request.signal,
    });
    if (request.signal.aborted) return requestAborted();
    if (response.status === 429) {
      return authError("Bạn thao tác quá nhiều lần. Chờ ít phút rồi thử lại.", 429, "RATE_LIMITED");
    }
    // BE luon tra 200 giong nhau du email co ton tai hay khong: giu nguyen de khong lo tai khoan.
    if (!response.ok) {
      return authError("Không gửi được yêu cầu lúc này. Thử lại sau ít phút.", response.status || 502, "FORGOT_UNAVAILABLE");
    }
    return Response.json({ success: true, message: GENERIC_SUCCESS }, { headers: { "cache-control": "no-store" } });
  } catch {
    if (request.signal.aborted) return requestAborted();
    return authError("Không kết nối được máy chủ. Thử lại sau.", 503, "AUTH_UNAVAILABLE");
  }
}
