import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { positiveId } from "@/lib/server/admin-stock";
import { cancelAdminOrder } from "@/lib/server/admin-order";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string, status: number, code: string) => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = positiveId((await params).id);
  if (id === null) return bad("Mã đơn chưa hợp lệ.", 400, "INVALID_ORDER_ID");
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu vượt quá giới hạn." : "Dữ liệu chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason);
  const reason = typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
  if (!reason || reason.length > 500) return bad("Lý do hủy phải từ 1 đến 500 ký tự.", 400, "INVALID_CANCEL_REASON");
  return cancelAdminOrder(request, id, reason);
}
