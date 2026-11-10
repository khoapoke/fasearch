import type { NextRequest } from "next/server";
import { analyticsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (message: string, status: number) =>
  Response.json({ success: false, code: status, message, result: null }, { status, headers: { "cache-control": "no-store" } });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/admin/reports/top-products?type&limit&startDate&endDate (BE CONTRACT v1, ADMIN + STAFF (Quản lý)). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const type = (q.get("type") ?? "BEST_SELLER").toUpperCase();
  if (!["BEST_SELLER", "SLOW_MOVING"].includes(type)) return bad("Loại top chưa hợp lệ (BEST_SELLER/SLOW_MOVING).", 400);
  const limitRaw = q.get("limit") ?? "10";
  if (!/^\d+$/.test(limitRaw)) return bad("Limit phải là số nguyên 1–100.", 400);
  const limit = Math.min(100, Math.max(1, Number(limitRaw)));
  const startDate = q.get("startDate") ?? "";
  const endDate = q.get("endDate") ?? "";
  if ((startDate || endDate) && (!DAY.test(startDate) || !DAY.test(endDate))) {
    return bad("Ngày phải đúng định dạng YYYY-MM-DD.", 400);
  }
  if (startDate && endDate && startDate > endDate) return bad("Từ ngày phải trước hoặc bằng đến ngày.", 400);
  const qs = new URLSearchParams({ type, limit: String(limit) });
  if (startDate) qs.set("startDate", startDate);
  if (endDate) qs.set("endDate", endDate);
  return analyticsUpstream(request, `/api/v1/analytics/top-products?${qs}`);
}
