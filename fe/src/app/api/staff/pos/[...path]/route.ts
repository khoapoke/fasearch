import type { NextRequest } from "next/server";
import { adminIdentity } from "@/lib/server/admin-bff";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { commerceUpstream } from "@/lib/server/customer-commerce";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { posDraftBody, posPaymentBody, posQuoteBody } from "@/lib/server/pos-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "cache-control": "no-store" };
const bad = (message = "Yêu cầu POS chưa hợp lệ.", status = 400) => Response.json({ success: false, code: status, message, result: null }, { status, headers: noStore });
const idOf = (raw: string) => /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;

async function upstream(request: NextRequest, path: string, method: "GET" | "POST", body?: Record<string, unknown>) {
  const identity = await adminIdentity(request);
  if ("response" in identity) return identity.response;
  return commerceUpstream(request, path, { method, ...(body ? { body } : {}), ...(method === "POST" ? { safeErrors: true } : {}) });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length === 1 && path[0] === "products") {
    const keyword = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!keyword || keyword.length > 100) return bad("Nhập từ khóa tìm sản phẩm.");
    return upstream(request, `/api/v1/products/pos-search?keyword=${encodeURIComponent(keyword)}`, "GET");
  }
  if (path.length === 1 && path[0] === "customers") {
    const phone = request.nextUrl.searchParams.get("phone") ?? "";
    if (!/^\d{9,11}$/.test(phone)) return bad("Số điện thoại khách chưa hợp lệ.");
    return upstream(request, `/api/v1/users/customers?keyword=${encodeURIComponent(phone)}&page=0&size=10`, "GET");
  }
  if (path.length === 1 && path[0] === "drafts") return upstream(request, "/api/v1/orders/pos/drafts", "GET");
  if (path.length === 2 && (path[0] === "drafts" || path[0] === "orders")) {
    const id = idOf(path[1]);
    return id ? upstream(request, `/api/v1/orders/${id}`, "GET") : bad("Mã đơn POS chưa hợp lệ.");
  }
  return bad("Không tìm thấy API POS.", 404);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const guard = requireJsonPost(request);
  if (guard) return new Response(guard.body, { status: guard.status, headers: { ...Object.fromEntries(guard.headers), ...noStore } });
  const parsed = await readBoundedJsonObject(request, 16 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu POS vượt quá giới hạn." : "Dữ liệu POS chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400);

  const { path } = await params;
  if (path.length === 1 && path[0] === "drafts") {
    const body = posDraftBody(parsed.body);
    return body ? upstream(request, "/api/v1/orders/pos/draft", "POST", body) : bad("Nháp POS chưa hợp lệ.");
  }
  if (path.length === 3 && path[0] === "orders" && path[2] === "quote") {
    const id = idOf(path[1]);
    const body = posQuoteBody(parsed.body);
    return id && body ? upstream(request, `/api/v1/orders/pos/${id}/quote`, "POST", body) : bad("Yêu cầu báo giá POS chưa hợp lệ.");
  }
  if (path.length === 3 && path[0] === "orders" && path[2] === "cancel") {
    const id = idOf(path[1]);
    const reason = parsed.body.reason;
    return id && typeof reason === "string" && reason.trim().length > 0 && [...reason.trim()].length <= 500
      ? upstream(request, `/api/v1/orders/${id}/cancel`, "POST", { reason: reason.trim() })
      : bad("Lý do hủy nháp chưa hợp lệ.");
  }
  if (path.length === 2 && path[0] === "payments" && path[1] === "process") {
    const body = posPaymentBody(parsed.body);
    return body ? upstream(request, "/api/v1/payments/process", "POST", body) : bad("Thanh toán POS chưa hợp lệ.");
  }
  return bad("Không tìm thấy API POS.", 404);
}
