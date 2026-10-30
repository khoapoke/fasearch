import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { positiveId } from "@/lib/server/admin-stock";
import { recordCashCollection } from "@/lib/server/admin-order";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string, status: number, code: string) => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = positiveId((await params).id);
  if (id === null) return bad("Mã đơn chưa hợp lệ.", 400, "INVALID_ORDER_ID");
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu vượt quá giới hạn." : "Dữ liệu chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason);
  const amountPaid = parsed.body.amountPaid;
  const note = parsed.body.note;
  if (typeof amountPaid !== "number" || !Number.isFinite(amountPaid) || amountPaid < 0 || (note !== null && note !== undefined && typeof note !== "string")) return bad("Thông tin thu tiền chưa hợp lệ.", 400, "INVALID_PAYMENT");
  return recordCashCollection(request, id, amountPaid, typeof note === "string" ? note : null);
}
