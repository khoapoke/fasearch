import type { NextRequest } from "next/server";
import { csvExport } from "@/lib/server/admin-csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS = new Set(["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "COMPLETED", "CANCELLED", "RETURNED"]);

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const status = p.get("status") ?? "";
  const orderCode = (p.get("orderCode") ?? "").trim();
  const customerPhone = (p.get("customerPhone") ?? "").trim();
  const keyword = (p.get("keyword") ?? "").trim();
  const startDate = p.get("startDate") ?? "";
  const endDate = p.get("endDate") ?? "";
  if ((status && !STATUS.has(status)) || orderCode.length > 50 || customerPhone.length > 20
    || keyword.length > 100
    || (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) {
    return Response.json({ success: false, code: 400, message: "Bộ lọc đơn hàng chưa hợp lệ.", result: null },
      { status: 400, headers: { "cache-control": "no-store" } });
  }
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (orderCode) q.set("orderCode", orderCode);
  if (customerPhone) q.set("customerPhone", customerPhone);
  if (keyword) q.set("keyword", keyword);
  if (startDate) q.set("startDate", startDate);
  if (endDate) q.set("endDate", endDate);
  return csvExport(request, `/api/v1/admin/csv/orders${q.size ? `?${q}` : ""}`);
}
