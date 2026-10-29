import { NextRequest, NextResponse } from "next/server";
import { authCookie, authError, clearAuthCookie, fetchMyInfo, requestAborted, validateIdentity } from "@/lib/server/customer-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = authCookie(request);
  if (!token) return authError("Cần đăng nhập để xem tài khoản.", 401, "NO_SESSION");
  try {
    const { response, payload } = await fetchMyInfo(token, request.signal);
    if (request.signal.aborted) return requestAborted();
    if (response.status === 401 || response.status === 403) {
      if (request.signal.aborted) return requestAborted();
      const out = authError("Phiên đăng nhập đã hết. Đăng nhập lại để tiếp tục.", 401, "SESSION_EXPIRED");
      clearAuthCookie(out, request);
      return out;
    }
    if (!response.ok) return authError("Không tải được thông tin tài khoản. Thử lại.", response.status || 502, "IDENTITY_UNAVAILABLE");
    const identity = validateIdentity(payload as never);
    if (identity.status !== "ACTIVE") {
      if (request.signal.aborted) return requestAborted();
      const out = authError("Tài khoản chưa hoạt động hoặc đã bị vô hiệu hóa.", 401, "ACCOUNT_INACTIVE");
      clearAuthCookie(out, request);
      return out;
    }
    return NextResponse.json({ success: true, identity }, { headers: { "cache-control": "no-store, private" } });
  } catch {
    if (request.signal.aborted) return requestAborted();
    return authError("Không tải được thông tin tài khoản. Thử lại.", 503, "IDENTITY_UNAVAILABLE");
  }
}
