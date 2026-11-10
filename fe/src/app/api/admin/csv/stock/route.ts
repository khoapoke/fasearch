import type { NextRequest } from "next/server";
import { csvExport } from "@/lib/server/admin-csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const sku = (p.get("sku") ?? "").trim();
  const productName = (p.get("productName") ?? "").trim();
  const keyword = (p.get("keyword") ?? "").trim();
  if (sku.length > 100 || productName.length > 255 || keyword.length > 100) {
    return Response.json({ success: false, code: 400, message: "Bộ lọc tồn kho chưa hợp lệ.", result: null },
      { status: 400, headers: { "cache-control": "no-store" } });
  }
  const q = new URLSearchParams();
  if (sku) q.set("sku", sku);
  if (productName) q.set("productName", productName);
  if (keyword) q.set("keyword", keyword);
  return csvExport(request, `/api/v1/admin/csv/stock${q.size ? `?${q}` : ""}`);
}
