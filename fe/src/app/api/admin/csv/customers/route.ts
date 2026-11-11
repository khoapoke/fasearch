import type { NextRequest } from "next/server";
import { csvExport } from "@/lib/server/admin-csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const keyword = (p.get("keyword") ?? "").trim();
  const tierId = p.get("tierId") ?? "";
  const salesTierId = p.get("salesTierId") ?? "";
  if (keyword.length > 100
    || (tierId && !/^[1-9]\d*$/.test(tierId))
    || (salesTierId && !/^[1-9]\d*$/.test(salesTierId))) {
    return Response.json({ success: false, code: 400, message: "Bộ lọc khách hàng chưa hợp lệ.", result: null },
      { status: 400, headers: { "cache-control": "no-store" } });
  }
  const q = new URLSearchParams();
  if (keyword) q.set("keyword", keyword);
  if (tierId) q.set("tierId", tierId);
  if (salesTierId) q.set("salesTierId", salesTierId);
  return csvExport(request, `/api/v1/admin/csv/customers${q.size ? `?${q}` : ""}`);
}
