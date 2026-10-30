import type { NextRequest } from "next/server";
import { customerRead, customerWrite } from "@/lib/server/admin-customer";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams; const page = Number(p.get("page") ?? "0"); const size = Number(p.get("size") ?? "10"); const keyword = (p.get("keyword") ?? "").trim();
  if (!Number.isInteger(page) || page < 0 || page > 10000 || !Number.isInteger(size) || size < 1 || size > 50 || keyword.length > 100) return Response.json({ success: false, code: 400, message: "Bộ lọc khách hàng chưa hợp lệ.", result: null }, { status: 400 });
  const q = new URLSearchParams({ page: String(page), size: String(size), sort: "id,desc" }); if (keyword) q.set("keyword", keyword);
  return customerRead(request, `/api/v1/users/customers?${q}`);
}
export async function POST(request: NextRequest) { return customerWrite(request, "/api/v1/users/customers", "POST", true); }
