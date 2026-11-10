import type { NextRequest } from "next/server";
import { analyticsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (message: string, status: number) =>
  Response.json({ success: false, code: status, message, result: null }, { status, headers: { "cache-control": "no-store" } });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/admin/reports/overview?startDate&endDate (BE: ADMIN + STAFF (Quản lý)). Aggregates for the "Tổng hợp" tab. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const startDate = q.get("startDate") ?? "";
  const endDate = q.get("endDate") ?? "";
  if (!DAY.test(startDate) || !DAY.test(endDate)) return bad("Ngày phải đúng định dạng YYYY-MM-DD.", 400);
  if (startDate > endDate) return bad("Từ ngày phải trước hoặc bằng đến ngày.", 400);
  const qs = new URLSearchParams({ startDate, endDate });
  return analyticsUpstream(request, `/api/v1/analytics/overview?${qs}`);
}
