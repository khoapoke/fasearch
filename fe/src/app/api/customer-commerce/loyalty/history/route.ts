import type { NextRequest } from "next/server";
import { commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = params.get("page") ?? "0";
  const size = params.get("size") ?? "20";
  if (!/^\d+$/.test(page) || Number(page) > 2_147_483_647 || !/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 100) {
    return Response.json({ success: false, code: 400, message: "Trang lịch sử chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  return commerceUpstream(request, `/api/v1/thanh-vien/lich-su?page=${page}&size=${size}`, { method: "GET", safeErrors: true });
}
