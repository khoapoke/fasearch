import type { NextRequest } from "next/server";
import { adminIdentity } from "@/lib/server/admin-bff";
import { authCookie, requireJsonPost } from "@/lib/server/customer-auth";

const noStore = { "cache-control": "no-store" };
const voucherMessages: Record<number, string> = {
  4101: "Mã voucher không tồn tại.",
  4102: "Chiến dịch hoặc mã voucher đang tạm dừng.",
  4103: "Voucher chưa đến thời gian sử dụng.",
  4104: "Voucher đã hết hạn.",
  4105: "Voucher đã hết lượt sử dụng.",
  4106: "Voucher không áp dụng cho giỏ hàng này.",
  4107: "Giá hoặc ưu đãi đã thay đổi. Hãy báo giá lại trước khi đặt hàng.",
  4108: "Yêu cầu đặt hàng đã thay đổi. Hãy tải lại giỏ hàng.",
  4109: "Chiến dịch đã được cập nhật. Hãy tải lại trước khi sửa tiếp.",
  4201: "Số dư điểm cũ chưa được ghi nhận mở đầu.",
  4202: "Chưa có chính sách điểm để đổi.",
  4203: "Chính sách điểm đang tắt; số dư vẫn được giữ.",
  4204: "Điểm vượt quá số dư hoặc mức giảm tối đa hiện tại.",
  4205: "Số dư khách đã được ghi nhận mở đầu trước đó.",
  4206: "Chính sách đã đổi. Tải lại rồi thử lại.",
  4207: "Ngưỡng hạng đã đổi. Tải lại rồi thử lại.",
  4208: "Trạng thái điểm đã thay đổi đồng thời. Tải lại báo giá.",
};

function jsonError(status: number, code: number | string, message: string): Response {
  return Response.json({ success: false, code, message, result: null }, { status, headers: noStore });
}

async function safeError(upstream: Response): Promise<Response> {
  let payload: { code?: unknown } | null = null;
  try { payload = await upstream.json(); } catch { /* use the status-only fallback */ }
  const code = typeof payload?.code === "number" && Number.isSafeInteger(payload.code) ? payload.code : upstream.status;
  const errors = Array.isArray((payload as { errors?: unknown } | null)?.errors)
    ? ((payload as { errors: unknown[] }).errors).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      return typeof item.field === "string" && typeof item.reason === "string" ? [{ field: item.field, reason: item.reason }] : [];
    })
    : undefined;
  const message = typeof code === "number" && voucherMessages[code]
    ? voucherMessages[code]
    : upstream.status === 401 ? "Vui lòng đăng nhập lại."
      : upstream.status === 403 ? "Bạn không có quyền thực hiện thao tác này."
        : upstream.status === 404 ? "Không tìm thấy dữ liệu yêu cầu."
          : upstream.status === 409 ? "Dữ liệu đã thay đổi. Tải lại rồi thử lại."
            : upstream.status >= 500 ? "Dịch vụ đang bận. Thử lại sau."
              : "Dữ liệu gửi lên chưa hợp lệ.";
  return Response.json({ success: false, code, message, ...(errors?.length ? { errors } : {}), result: null }, { status: upstream.status, headers: noStore });
}

export async function promotionsUpstream(
  request: NextRequest,
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: Record<string, unknown>,
): Promise<Response> {
  if (method !== "GET") {
    const guard = requireJsonPost(request);
    if (guard) return new Response(guard.body, { status: guard.status, headers: { ...Object.fromEntries(guard.headers), ...noStore } });
  }
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  if (who.identity.role !== "ADMIN") return jsonError(403, 403, "Chỉ ADMIN được quản lý khuyến mãi.");
  const token = authCookie(request);
  if (!token) return jsonError(401, 401, "Thiếu phiên quản trị.");
  let base: string;
  try {
    // Một upstream hiển cấu hình cho mọi lệnh benefits/loyalty (S1).
    // Không port cứng: thiếu cấu hình là lỗi triển khai, báo 503 thật.
    const raw = process.env.FASEARCH_BACKEND_URL;
    if (!raw) throw new Error("benefits upstream not configured");
    base = raw.replace(/\/+$/, "");
  } catch {
    return jsonError(503, 503, "Máy chủ chưa cấu hình upstream benefits.");
  }
  try {
    const upstream = await fetch(`${base}${path}`, {
      method,
      headers: { accept: "application/json", authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    });
    if (!upstream.ok) return safeError(upstream);
    const headers = new Headers(noStore);
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return jsonError(503, 503, "Không kết nối được máy chủ khuyến mãi.");
  }
}

export function promotionId(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
