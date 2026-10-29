import type { NextRequest } from "next/server";
import { authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES = new Set(["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "COMPLETED", "CANCELLED", "RETURNED"]);

export async function GET(request: NextRequest) {
  const pageRaw = request.nextUrl.searchParams.get("page") ?? "0";
  const sizeRaw = request.nextUrl.searchParams.get("size") ?? "10";
  const page = Number(pageRaw); const size = Number(sizeRaw);
  if (!Number.isInteger(page) || page < 0 || page > 10000) return authError("Trang chưa hợp lệ.", 400, "INVALID_PAGE");
  if (!Number.isInteger(size) || size < 1 || size > 50) return authError("Kích thước trang chưa hợp lệ.", 400, "INVALID_PAGE_SIZE");
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const orderCode = (request.nextUrl.searchParams.get("orderCode") ?? "").trim();
  if (status && !STATUSES.has(status)) return authError("Trạng thái chưa hợp lệ.", 400, "INVALID_STATUS");
  if (orderCode.length > 50) return authError("Mã đơn quá dài.", 400, "INVALID_ORDER_CODE");
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) q.set("status", status);
  if (orderCode) q.set("orderCode", orderCode);
  return commerceUpstream(request, `/api/v1/orders?${q.toString()}`, { method: "GET" });
}

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
  const receiverName = typeof body.receiverName === "string" ? body.receiverName.trim() : "";
  const receiverPhone = typeof body.receiverPhone === "string" ? body.receiverPhone.trim() : "";
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "";
  const shippingFee = body.shippingFee;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (deliveryAddress.length < 5 || deliveryAddress.length > 255) return authError("Địa chỉ giao hàng chưa hợp lệ.", 400, "INVALID_ADDRESS");
  if (receiverName.length < 2 || receiverName.length > 100) return authError("Tên người nhận chưa hợp lệ.", 400, "INVALID_RECEIVER");
  if (!/^\d{9,11}$/.test(receiverPhone.replace(/[ .-]/g, ""))) return authError("Số điện thoại người nhận chưa hợp lệ.", 400, "INVALID_PHONE");
  if (paymentMethod !== "COD") return authError("Pilot chỉ hỗ trợ COD.", 400, "UNSUPPORTED_PAYMENT");
  if (typeof shippingFee !== "number" || !Number.isFinite(shippingFee) || shippingFee < 0 || shippingFee > 10000000) return authError("Phí giao hàng chưa hợp lệ.", 400, "INVALID_SHIPPING_FEE");
  if (note.length > 500) return authError("Ghi chú tối đa 500 ký tự.", 400, "INVALID_NOTE");
  return commerceUpstream(request, "/api/v1/orders/checkout", {
    method: "POST",
    body: { deliveryAddress, receiverName, receiverPhone, paymentMethod, shippingFee, ...(note ? { note } : {}) },
  });
}
