import { NextRequest, NextResponse } from "next/server";
import {
  authError, fetchMyInfo, forwardAuth, mapUpstreamError, requireJsonPost,
  setAuthCookie, validateAuthResult, validateIdentity,
} from "@/lib/server/customer-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return authError("Dữ liệu gửi lên chưa hợp lệ.", 400, "INVALID_REQUEST"); }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const gender = typeof body.gender === "string" ? body.gender : "";
  if (!username || !password || !email || !lastName || !phoneNumber) {
    return authError("Điền đủ tên đăng nhập, mật khẩu, email, họ và số điện thoại.", 400, "INVALID_REQUEST");
  }
  if (username.length < 4 || username.length > 50) return authError("Tên đăng nhập phải từ 4 đến 50 ký tự.", 400, "INVALID_REQUEST");
  if (password.length < 6 || password.length > 100) return authError("Mật khẩu phải từ 6 đến 100 ký tự.", 400, "INVALID_REQUEST");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError("Email chưa đúng định dạng.", 400, "INVALID_REQUEST");
  if (gender && !GENDERS.has(gender)) return authError("Giới tính chưa hợp lệ.", 400, "INVALID_REQUEST");
  try {
    const { response, payload } = await forwardAuth("/api/v1/auth/register", {
      username, password, email,
      ...(firstName ? { firstName } : {}),
      lastName, phoneNumber,
      ...(gender ? { gender } : {}),
    });
    if (!response.ok) {
      const mapped = mapUpstreamError(response.status, payload);
      return authError(mapped.message, response.status, mapped.code, mapped.errors);
    }
    const auth = validateAuthResult(payload as never);
    const identityResult = await fetchMyInfo(auth.accessToken);
    if (!identityResult.response.ok) {
      return authError("Đăng ký chưa được xác nhận. Thử lại.", 502, "IDENTITY_UNAVAILABLE");
    }
    const identity = validateIdentity(identityResult.payload as never);
    if (identity.role !== "CUSTOMER" || identity.status !== "ACTIVE") {
      return authError("Tài khoản đăng ký chưa đúng trạng thái khách hàng.", 502, "IDENTITY_INVALID");
    }
    const out = NextResponse.json({ success: true, identity });
    setAuthCookie(out, request, auth.accessToken, auth.expiresIn);
    return out;
  } catch {
    return authError("Không thể đăng ký lúc này. Thử lại sau ít phút.", 503, "AUTH_UNAVAILABLE");
  }
}
