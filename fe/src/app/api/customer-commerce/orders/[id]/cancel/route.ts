import type { NextRequest } from "next/server";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { commerceId, commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string, status = 400, code = "INVALID_REQUEST") => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = requireJsonPost(request);
  if (guard) return new Response(guard.body, { status: guard.status, headers: { "cache-control": "no-store" } });
  const id = commerceId((await context.params).id);
  if (id === null) return bad("Mã đơn chưa hợp lệ.", 400, "INVALID_ORDER_ID");
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu gửi lên vượt quá giới hạn." : "Dữ liệu gửi lên chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason === "TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST");
  const reason = typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
  if (!reason || reason.length > 500) return bad("Lý do hủy phải từ 1 đến 500 ký tự.", 400, "INVALID_CANCEL_REASON");
  return commerceUpstream(request, `/api/v1/orders/${id}/cancel`, { method: "POST", body: { reason }, safeErrors: true });
}
