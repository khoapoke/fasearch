import type { NextRequest } from "next/server";
import { analyticsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (message: string, status: number) =>
  Response.json({ success: false, code: status, message, result: null }, { status, headers: { "cache-control": "no-store" } });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/admin/reports/revenue?period&startDate&endDate&channel (BE CONTRACT v1, ADMIN only). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const period = q.get("period") ?? "DAY";
  if (!["DAY", "WEEK", "MONTH", "YEAR"].includes(period)) return bad("Chu kỳ chưa hợp lệ (DAY/WEEK/MONTH/YEAR).", 400);
  const startDate = q.get("startDate") ?? "";
  const endDate = q.get("endDate") ?? "";
  if (!DAY.test(startDate) || !DAY.test(endDate)) return bad("Ngày phải đúng định dạng YYYY-MM-DD.", 400);
  if (startDate > endDate) return bad("Từ ngày phải trước hoặc bằng đến ngày.", 400);
  const channel = q.get("channel") ?? "ALL";
  if (channel !== "ALL") return bad("Danh mục kênh duy nhất được hỗ trợ là ALL (schema không có cột kênh).", 400);
  const qs = new URLSearchParams({ period, startDate, endDate, channel });
  return analyticsUpstream(request, `/api/v1/analytics/revenue?${qs}`);
}
