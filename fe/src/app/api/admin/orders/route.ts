import type { NextRequest } from "next/server";
import { adminRead, validStatus } from "@/lib/server/admin-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const page = Number(p.get("page") ?? "0"); const size = Number(p.get("size") ?? "10");
  if (!Number.isInteger(page) || page < 0 || page > 10000 || !Number.isInteger(size) || size < 1 || size > 50) return Response.json({ success: false, code: 400, message: "Phân trang chưa hợp lệ.", result: null }, { status: 400 });
  const status = p.get("status") ?? "";
  if (status && !validStatus(status)) return Response.json({ success: false, code: 400, message: "Trạng thái chưa hợp lệ.", result: null }, { status: 400 });
  const orderCode = (p.get("orderCode") ?? "").trim();
  const customerPhone = (p.get("customerPhone") ?? "").trim();
  const keyword = (p.get("keyword") ?? "").trim();
  const startDate = p.get("startDate") ?? ""; const endDate = p.get("endDate") ?? "";
  const sort = p.get("sort") ?? "orderDate,desc";
  if (orderCode.length > 50 || customerPhone.length > 20 || keyword.length > 100) return Response.json({ success: false, code: 400, message: "Bộ lọc quá dài.", result: null }, { status: 400 });
  if (sort !== "orderDate,desc" && sort !== "orderDate,asc") return Response.json({ success: false, code: 400, message: "Sắp xếp chưa hỗ trợ.", result: null }, { status: 400 });
  const q = new URLSearchParams({ page: String(page), size: String(size), sort });
  if (status) q.set("status", status); if (orderCode) q.set("orderCode", orderCode); if (customerPhone) q.set("customerPhone", customerPhone); if (keyword) q.set("keyword", keyword);
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) q.set("startDate", startDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) q.set("endDate", endDate);
  return adminRead(request, `/api/v1/orders?${q}`);
}
