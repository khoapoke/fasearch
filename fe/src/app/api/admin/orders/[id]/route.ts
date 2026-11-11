import type { NextRequest } from "next/server";
import { adminRead } from "@/lib/server/admin-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id) || Number(id) < 1) return Response.json({ success: false, code: 400, message: "Mã đơn chưa hợp lệ.", result: null }, { status: 400 });
  return adminRead(request, `/api/v1/orders/${id}`);
}
