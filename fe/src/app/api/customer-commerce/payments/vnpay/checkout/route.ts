import type { NextRequest } from "next/server";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string, status = 400, code = "INVALID_REQUEST") => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return new Response(guard.body, { status: guard.status, headers: { "cache-control": "no-store" } });
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu gửi lên vượt quá giới hạn." : "Dữ liệu gửi lên chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason === "TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST");
  const orderId = parsed.body.orderId;
  const key = parsed.body.idempotencyKey;
  if (!Number.isSafeInteger(orderId) || (orderId as number) <= 0) return bad("Mã đơn hàng chưa hợp lệ.");
  if (typeof key !== "string" || !key.trim() || key.length > 100) return bad("Khóa idempotency chưa hợp lệ.");
  return commerceUpstream(request, "/api/v1/payments/vnpay/checkout", { method: "POST", body: { orderId, idempotencyKey: (key as string).trim() }, safeErrors: true });
}
