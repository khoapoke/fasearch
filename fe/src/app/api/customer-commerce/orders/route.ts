import type { NextRequest } from "next/server";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { commerceUpstream } from "@/lib/server/customer-commerce";
import { checkoutBody } from "@/lib/server/customer-commerce-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const STATUSES = new Set(["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "COMPLETED", "CANCELLED", "RETURNED"]);
const bad = (message: string, status = 400, code = "INVALID_REQUEST") => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  const pageRaw = request.nextUrl.searchParams.get("page") ?? "0";
  const sizeRaw = request.nextUrl.searchParams.get("size") ?? "10";
  const page = Number(pageRaw); const size = Number(sizeRaw);
  if (!Number.isInteger(page) || page < 0 || page > 10000) return bad("Trang chưa hợp lệ.", 400, "INVALID_PAGE");
  if (!Number.isInteger(size) || size < 1 || size > 50) return bad("Kích thước trang chưa hợp lệ.", 400, "INVALID_PAGE_SIZE");
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const orderCode = (request.nextUrl.searchParams.get("orderCode") ?? "").trim();
  if (status && !STATUSES.has(status)) return bad("Trạng thái chưa hợp lệ.", 400, "INVALID_STATUS");
  if (orderCode.length > 50) return bad("Mã đơn quá dài.", 400, "INVALID_ORDER_CODE");
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) q.set("status", status);
  if (orderCode) q.set("orderCode", orderCode);
  return commerceUpstream(request, `/api/v1/orders?${q.toString()}`, { method: "GET" });
}

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return new Response(guard.body, { status: guard.status, headers: { "cache-control": "no-store" } });
  const parsed = await readBoundedJsonObject(request, 16 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu gửi lên vượt quá giới hạn." : "Dữ liệu gửi lên chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason === "TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST");
  const validated = checkoutBody(parsed.body);
  if (!validated.ok) return bad(validated.message, validated.status, validated.code);
  return commerceUpstream(request, "/api/v1/orders/checkout", {
    method: "POST", safeErrors: true, body: validated.body,
  });
}
