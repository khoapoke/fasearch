import type { NextRequest } from "next/server";
import { analyticsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (message: string, status: number) =>
  Response.json({ success: false, code: status, message, result: null }, { status, headers: { "cache-control": "no-store" } });

/**
 * GET /api/admin/reports/inventory-movement?page&size&month&sku (BE CONTRACT v1, ADMIN + STAFF (Quản lý)).
 * FE contract keeps month=MM-YYYY; this BFF translates to the BE-required
 * year+month integers (F-ABR-01: missing params fell through to /error and
 * surfaced as a misleading 401). Omitted month defaults to the current HCMC
 * month — stated in UI, no silent reinterpretation of the filter meaning.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const page = q.get("page") ?? "0";
  const size = q.get("size") ?? "20";
  if (!/^\d+$/.test(page) || Number(page) > 2_147_483_647 || !/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 100) {
    return bad("Bộ lọc trang chưa hợp lệ.", 400);
  }
  const month = q.get("month") ?? "";
  let year: number;
  let monthNum: number;
  if (month) {
    if (!/^(0[1-9]|1[0-2])-\d{4}$/.test(month)) return bad("Tháng phải đúng định dạng MM-YYYY.", 400);
    monthNum = Number(month.slice(0, 2));
    year = Number(month.slice(3));
  } else {
    // Mặc định tháng hiện tại (HCMC) — hiển thị rõ ở UI, BE yêu cầu year+month.
    const now = new Date(Date.now() + 7 * 3600_000);
    year = now.getUTCFullYear();
    monthNum = now.getUTCMonth() + 1;
  }
  const sku = (q.get("sku") ?? "").trim().slice(0, 64);
  const qs = new URLSearchParams({ year: String(year), month: String(monthNum), page, size });
  if (sku) qs.set("sku", sku);
  return analyticsUpstream(request, `/api/v1/analytics/inventory-movement?${qs}`);
}
