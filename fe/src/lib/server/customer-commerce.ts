import type { NextRequest } from "next/server";
import { authCookie } from "@/lib/server/customer-auth";

// Narrow same-origin commerce transport. The JWT stays server-side and is sent
// as Bearer only to the fixed candidate BE; no legacy session/cookie fallback.
const COMMERCE_BASE = "http://127.0.0.1:18124";

function timeoutSignal(signal: AbortSignal): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(12000)]);
}

export async function commerceUpstream(
  request: NextRequest,
  path: string,
  init: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; safeErrors?: boolean } = { method: "GET" },
): Promise<Response> {
  const token = authCookie(request);
  if (!token) {
    return Response.json({ success: false, code: 401, message: "Cần đăng nhập để dùng giỏ hàng.", result: null }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  let upstream: Response;
  try {
    upstream = await fetch(`${COMMERCE_BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      redirect: "manual",
      signal: timeoutSignal(request.signal),
    });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ giỏ hàng.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (init.safeErrors && !upstream.ok) {
    let code: number | string = upstream.status;
    try {
      const payload = await upstream.json() as { code?: unknown };
      if (typeof payload.code === "number" && Number.isSafeInteger(payload.code)) code = payload.code;
    } catch { /* use the status-only fallback */ }
    const messages: Record<number, string> = {
      4101: "Mã voucher không tồn tại.", 4102: "Chiến dịch hoặc mã voucher đang tạm dừng.",
      4103: "Voucher chưa đến thời gian sử dụng.", 4104: "Voucher đã hết hạn.",
      4105: "Voucher đã hết lượt sử dụng.", 4106: "Voucher không áp dụng cho giỏ hàng này.",
      4107: "Giá hoặc ưu đãi đã thay đổi. Hãy báo giá lại trước khi đặt hàng.",
      4108: "Yêu cầu đặt hàng đã thay đổi. Hãy tải lại giỏ hàng.",
      4109: "Chiến dịch đã được cập nhật. Hãy tải lại trước khi sửa tiếp.",
    };
    const message = typeof code === "number" && messages[code] ? messages[code]
      : upstream.status === 401 ? "Vui lòng đăng nhập lại."
        : upstream.status === 403 ? "Bạn không có quyền thực hiện thao tác này."
          : upstream.status === 404 ? "Không tìm thấy dữ liệu yêu cầu."
            : upstream.status === 409 ? "Dữ liệu đã thay đổi. Tải lại rồi thử lại."
              : upstream.status >= 500 ? "Dịch vụ đang bận. Thử lại sau."
                : "Yêu cầu chưa thể xử lý.";
    return Response.json({ success: false, code, message, result: null }, { status: upstream.status, headers: { "cache-control": "no-store" } });
  }
  const out = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export function commerceId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
