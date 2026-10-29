import { NextRequest, NextResponse } from "next/server";
import {
  authError, fetchMyInfo, forwardAuth,
  mapUpstreamError, readJsonObject, requestAborted, requireJsonPost, setAuthCookie,
  validateAuthResult, validateIdentity,
} from "@/lib/server/customer-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (typeof body.username !== "string" || typeof body.password !== "string" || !body.username.trim() || !body.password) {
    return authError("Nhập tên đăng nhập và mật khẩu.", 400, "INVALID_REQUEST");
  }
  try {
    const { response, payload } = await forwardAuth("/api/v1/auth/login", {
      username: body.username.trim(),
      password: body.password,
    }, request.signal);
    if (request.signal.aborted) return requestAborted();
    if (!response.ok) {
      const mapped = mapUpstreamError(response.status, payload);
      return authError(mapped.message, response.status, mapped.code, mapped.errors);
    }
    const auth = validateAuthResult(payload as never);
    const identityResult = await fetchMyInfo(auth.accessToken, request.signal);
    if (request.signal.aborted) return requestAborted();
    if (!identityResult.response.ok) {
      return authError("Đăng nhập chưa được xác nhận. Thử lại.", 502, "IDENTITY_UNAVAILABLE");
    }
    const identity = validateIdentity(identityResult.payload as never);
    if (identity.status !== "ACTIVE") {
      return authError("Tài khoản chưa hoạt động hoặc đã bị vô hiệu hóa.", 403, "ACCOUNT_INACTIVE");
    }
    if (request.signal.aborted) return requestAborted();
    const out = NextResponse.json({ success: true, identity });
    setAuthCookie(out, request, auth.accessToken, auth.expiresIn);
    return out;
  } catch {
    if (request.signal.aborted) return requestAborted();
    return authError("Không thể đăng nhập lúc này. Thử lại sau ít phút.", 503, "AUTH_UNAVAILABLE");
  }
}
