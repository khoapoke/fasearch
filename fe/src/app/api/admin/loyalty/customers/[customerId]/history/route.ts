import type { NextRequest } from "next/server";
import { promotionId, promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string) => Response.json({ success: false, code: 400, message, result: null }, { status: 400, headers: { "cache-control": "no-store" } });

/** Lịch sử điểm của một khách (có lý do, ghi chú, người thực hiện). Quản lý và Quản trị viên. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const customerId = promotionId((await params).customerId);
  if (!customerId) return bad("Mã khách hàng chưa hợp lệ.");
  const source = request.nextUrl.searchParams;
  const page = source.get("page") ?? "0";
  const size = source.get("size") ?? "20";
  if (!/^\d+$/.test(page) || Number(page) > 2_147_483_647 || !/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 100) return bad("Trang lịch sử chưa hợp lệ.");
  return promotionsUpstream(request, `/api/v1/quan-tri/thanh-vien/khach-hang/${customerId}/lich-su?page=${page}&size=${size}`, "GET");
}
