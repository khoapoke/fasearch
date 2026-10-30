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
  const value = parsed.body.voucherCode;
  if (value !== undefined && value !== null && typeof value !== "string") return bad("Mã voucher chưa hợp lệ.");
  if (typeof value === "string" && value.trim().length > 50) return bad("Mã voucher phải tối đa 50 ký tự.");
  const voucherCode = typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
  return commerceUpstream(request, "/api/v1/cart/quote", { method: "POST", body: { voucherCode }, safeErrors: true });
}
