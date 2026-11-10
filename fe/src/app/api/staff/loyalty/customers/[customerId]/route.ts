import type { NextRequest } from "next/server";
import { commerceUpstream, commerceId } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId: raw } = await params;
  const customerId = commerceId(raw);
  if (!customerId) return Response.json({ success: false, code: 400, message: "Mã khách hàng chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return commerceUpstream(request, `/api/v1/thanh-vien/khach-hang/${customerId}`, { method: "GET" });
}
