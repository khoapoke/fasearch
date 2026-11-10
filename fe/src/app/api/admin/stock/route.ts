import type { NextRequest } from "next/server";
import { stockRead } from "@/lib/server/admin-stock";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams; const page = Number(p.get("page") ?? "0"); const size = Number(p.get("size") ?? "10");
  if (!Number.isInteger(page) || page < 0 || page > 10000 || !Number.isInteger(size) || size < 1 || size > 50) return Response.json({ success: false, code: 400, message: "Phân trang chưa hợp lệ.", result: null }, { status: 400 });
  const q = new URLSearchParams({ page: String(page), size: String(size), sort: "id,desc" });
  for (const k of ["sku", "productName", "keyword"]) { const v = p.get(k); if (v) q.set(k, v); }
  if ((q.get("keyword") ?? "").length > 100 || (q.get("sku") ?? "").length > 100 || (q.get("productName") ?? "").length > 255) return Response.json({ success: false, code: 400, message: "Bộ lọc quá dài.", result: null }, { status: 400 });
  return stockRead(request, `/api/v1/inventory/stock?${q}`);
}
