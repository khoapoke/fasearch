import type { NextRequest } from "next/server";
import { authCookie } from "@/lib/server/customer-auth";

// Narrow same-origin commerce transport. The JWT stays server-side and is sent
// as Bearer only to the fixed candidate BE; no legacy session/cookie fallback.
const COMMERCE_BASE = process.env.FASEARCH_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:18126";

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
  if (!upstream.ok) {
    let code: number | string = upstream.status;
    let upstreamMessage = "";
    let errors: Array<{ field: string; reason: string }> | undefined;
    try {
      const payload = await upstream.json() as { code?: unknown; message?: unknown; errors?: unknown };
      if (typeof payload.code === "number" && Number.isSafeInteger(payload.code)) code = payload.code;
      if (typeof payload.message === "string") upstreamMessage = payload.message;
      if (Array.isArray(payload.errors)) errors = payload.errors.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        return typeof item.field === "string" && typeof item.reason === "string" ? [{ field: item.field, reason: item.reason }] : [];
      });
    } catch { /* use the status-only fallback */ }
    const messages: Record<number, string> = {
      4101: "Mã voucher không tồn tại.", 4102: "Chiến dịch hoặc mã voucher đang tạm dừng.",
      4103: "Voucher chưa đến thời gian sử dụng.", 4104: "Voucher đã hết hạn.",
      4105: "Voucher đã hết lượt sử dụng.", 4106: "Voucher không áp dụng cho giỏ hàng này.",
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
    let message = typeof code === "number" && messages[code] ? messages[code] : "";
    if (!message && upstreamMessage) {
      if (/insufficient.*stock|hết hàng|tồn kho/i.test(upstreamMessage)) {
        message = "Sản phẩm hoặc biến thể này hiện không đủ số lượng tồn kho.";
      } else if (/cart.*empty|giỏ hàng.*trống/i.test(upstreamMessage)) {
        message = "Giỏ hàng hiện đang trống.";
      } else if (/access denied|forbidden|không có quyền|permission/i.test(upstreamMessage)) {
        message = "Tài khoản không có quyền thực hiện thao tác này.";
      } else if (/unauthenticated|unauthorized|hết phiên/i.test(upstreamMessage)) {
        message = "Vui lòng đăng nhập lại để tiếp tục.";
      } else if (/not found|không tìm thấy/i.test(upstreamMessage)) {
        message = "Không tìm thấy dữ liệu yêu cầu.";
      } else if (/already paid|đã thanh toán/i.test(upstreamMessage)) {
        message = "Đơn hàng đã được thanh toán.";
      } else if (/invoice before completion/i.test(upstreamMessage)) {
        message = "Đơn hàng cần được ghi nhận thu tiền (hóa đơn) trước khi hoàn tất.";
      }
    }
    if (!message) {
      message = upstream.status === 401 ? "Vui lòng đăng nhập lại."
        : upstream.status === 403 ? "Bạn không có quyền thực hiện thao tác này."
          : upstream.status === 404 ? "Không tìm thấy dữ liệu yêu cầu."
            : upstream.status === 409 ? "Dữ liệu đã thay đổi. Tải lại rồi thử lại."
              : upstream.status >= 500 ? "Dịch vụ đang bận. Thử lại sau."
                : "Yêu cầu chưa thể xử lý. Kiểm tra lại dữ liệu.";
    }
    return Response.json({ success: false, code, message, ...(errors?.length ? { errors } : {}), result: null }, { status: upstream.status, headers: { "cache-control": "no-store" } });
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
