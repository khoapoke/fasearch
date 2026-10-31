import type { NextRequest } from "next/server";
import { authError } from "@/lib/server/customer-auth";
import { commerceId, commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: raw } = await context.params;
  const id = commerceId(raw);
  if (id === null) return authError("Mã đơn chưa hợp lệ.", 400, "INVALID_ORDER_ID");
  return commerceUpstream(request, `/api/v1/orders/${id}`, { method: "GET" });
}
