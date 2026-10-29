import type { NextRequest } from "next/server";
import { authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { commerceId, commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const { id: raw } = await context.params;
  const id = commerceId(raw);
  if (id === null) return authError("Mã đơn chưa hợp lệ.", 400, "INVALID_ORDER_ID");
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const reason = typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
  if (!reason || reason.length > 500) return authError("Lý do hủy phải từ 1 đến 500 ký tự.", 400, "INVALID_CANCEL_REASON");
  return commerceUpstream(request, `/api/v1/orders/${id}/cancel`, { method: "POST", body: { reason } });
}
