import type { NextRequest } from "next/server";
import { analyticsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (message: string, status: number) =>
  Response.json({ success: false, code: status, message, result: null }, { status, headers: { "cache-control": "no-store" } });

/** GET /api/admin/reports/inventory-movement?page&size&month&sku (BE CONTRACT v1, ADMIN only). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const page = q.get("page") ?? "0";
  const size = q.get("size") ?? "20";
  if (!/^\d+$/.test(page) || Number(page) > 2_147_483_647 || !/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 100) {
    return bad("Bộ lọc trang chưa hợp lệ.", 400);
  }
  const month = q.get("month") ?? "";
  if (month && !/^\d{2}-\d{4}$/.test(month)) return bad("Tháng phải đúng định dạng MM-YYYY.", 400);
  const sku = (q.get("sku") ?? "").trim().slice(0, 64);
  const qs = new URLSearchParams({ page, size });
  if (month) qs.set("month", month);
  if (sku) qs.set("sku", sku);
  return analyticsUpstream(request, `/api/v1/analytics/inventory-movement?${qs}`);
}
