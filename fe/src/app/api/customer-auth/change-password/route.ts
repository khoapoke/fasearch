import type { NextRequest } from "next/server";
import { authCookie, authError, fetchMyInfo, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { authBackendUrl } from "@/lib/server/be-upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const token = authCookie(request);
  if (!token) return authError("Cần đăng nhập để đổi mật khẩu.", 401, "AUTH_REQUIRED");
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (typeof body.oldPassword !== "string" || !body.oldPassword || typeof body.newPassword !== "string" || !body.newPassword) {
    return authError("Nhập mật khẩu hiện tại và mật khẩu mới.", 400, "INVALID_REQUEST");
  }
  try {
    const { response, payload } = await (async () => {
      const r = await fetch(`${authBackendUrl()}/api/v1/auth/change-password`, {
        method: "POST",
        cache: "no-store",
        headers: { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ oldPassword: body.oldPassword, newPassword: body.newPassword }),
        signal: request.signal,
      });
      let p: unknown = null;
      try { p = await r.json(); } catch { /* non-json */ }
      return { response: r, payload: p as { success?: boolean; code?: number; message?: string } | null };
    })();
    if (response.status === 401) return authError(payload?.message || "Mật khẩu hiện tại chưa đúng.", 401, "INVALID_OLD_PASSWORD");
    if (response.status === 400) return authError(payload?.message || "Mật khẩu mới chưa đạt yêu cầu.", 400, "INVALID_NEW_PASSWORD");
    if (!response.ok || payload?.success !== true) return authError(payload?.message || "Đổi mật khẩu chưa thành công.", response.status || 502, "CHANGE_PASSWORD_FAILED");
    return Response.json({ success: true, code: 200, message: payload?.message || "Đổi mật khẩu thành công", result: null }, { headers: { "cache-control": "no-store" } });
  } catch {
    return authError("Không kết nối được máy chủ. Thử lại sau.", 503, "AUTH_UNAVAILABLE");
  }
}
