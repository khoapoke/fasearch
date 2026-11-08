import type { NextRequest } from "next/server";
import { authCookie, authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity, BE } from "@/lib/server/admin-bff";

/** Guard codes whose messages are written for staff and may be forwarded verbatim. */
const STAFF_GUARD = { min: 4401, max: 4408 };

function refusal(status: number, code: number, upstream: string | null, noun: string): { message: string; code: number } {
  if (upstream && code >= STAFF_GUARD.min && code <= STAFF_GUARD.max) return { message: upstream, code };
  if (status === 401) return { message: "Phiên quản trị đã hết hạn. Đăng nhập lại rồi thử tiếp.", code: 401 };
  if (status === 403) return { message: `Tài khoản không có quyền xóa ${noun}.`, code: 403 };
  if (status === 404) return { message: `Không tìm thấy ${noun} cần xóa. Tải lại danh sách rồi thử tiếp.`, code: 404 };
  if (status === 409) return { message: `Không thể xóa ${noun} vì dữ liệu vẫn đang được dùng. Tải lại rồi thử tiếp.`, code: 409 };
  if (status === 400) return { message: "Yêu cầu xóa chưa hợp lệ.", code: 400 };
  return { message: `Máy chủ chưa xóa được ${noun}. Thử lại sau.`, code: status || 502 };
}

/**
 * Xóa mềm kèm lý do cho hồ sơ khách hàng, hồ sơ nhân sự và tài khoản đăng nhập.
 *
 * Hộp thoại gửi JSON nên phải qua kiểm tra origin; thông báo từ chối của guard BE (4401-4408,
 * viết cho nhân viên) được chuyển nguyên văn, mọi lỗi khác đổi sang câu tiếng Việt để không lộ
 * chuỗi kỹ thuật của BE. Tài khoản đăng nhập là việc quản trị: chỉ ADMIN đi qua nhánh này.
 */
export async function deleteWithReason(
  request: NextRequest,
  path: string,
  options: { noun: string; adminOnly: boolean; unavailable: string },
): Promise<Response> {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  if (options.adminOnly && who.identity.role !== "ADMIN") {
    return authError("Chỉ Quản trị viên hệ thống được xóa tài khoản đăng nhập.", 403, "ADMIN_REQUIRED");
  }
  const token = authCookie(request);
  if (!token) return authError("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED");
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const raw = parsed.body.reason;
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length > 255) return authError("Lý do xóa tối đa 255 ký tự.", 400, "INVALID_REASON");
  try {
    const upstream = await fetch(`${BE}${path}`, {
      method: "DELETE",
      headers: { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    });
    if (upstream.ok) {
      return Response.json(
        { success: true, code: 200, message: "Đã chuyển vào thùng rác.", result: true },
        { headers: { "cache-control": "no-store" } },
      );
    }
    let payload: { message?: string; code?: number } | null = null;
    try {
      payload = (await upstream.json()) as { message?: string; code?: number } | null;
    } catch {
      payload = null;
    }
    const mapped = refusal(upstream.status, Number(payload?.code ?? 0), payload?.message ?? null, options.noun);
    return Response.json({ success: false, code: mapped.code, message: mapped.message, result: null }, {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return authError(options.unavailable, 503, "PEOPLE_UNAVAILABLE");
  }
}
