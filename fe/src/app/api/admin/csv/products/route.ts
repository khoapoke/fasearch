import type { NextRequest } from "next/server";
import { csvExport } from "@/lib/server/admin-csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS = new Set(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"]);
const PRICE = /^\d{1,15}(\.\d{1,2})?$/;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const keyword = (p.get("keyword") ?? "").trim();
  const categoryId = p.get("categoryId") ?? "";
  const status = p.get("status") ?? "";
  const minPrice = p.get("minPrice") ?? "";
  const maxPrice = p.get("maxPrice") ?? "";
  if (keyword.length > 100
    || (categoryId && !/^[1-9]\d*$/.test(categoryId))
    || (status && !STATUS.has(status))
    || (minPrice && !PRICE.test(minPrice))
    || (maxPrice && !PRICE.test(maxPrice))) {
    return Response.json({ success: false, code: 400, message: "Bộ lọc sản phẩm chưa hợp lệ.", result: null },
      { status: 400, headers: { "cache-control": "no-store" } });
  }
  const q = new URLSearchParams();
  if (keyword) q.set("keyword", keyword);
  if (categoryId) q.set("categoryId", categoryId);
  if (status) q.set("status", status);
  if (minPrice) q.set("minPrice", minPrice);
  if (maxPrice) q.set("maxPrice", maxPrice);
  return csvExport(request, `/api/v1/admin/csv/products${q.size ? `?${q}` : ""}`);
}
