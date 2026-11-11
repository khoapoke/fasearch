import type { NextRequest } from "next/server";
import { stockRead } from "@/lib/server/admin-stock";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";

/** GET /api/admin/stock-summary?limit=20 — whole-catalog aggregates + bounded exceptions (BE CONTRACT v1, ADMIN+STAFF, no financial field). */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit") ?? "20";
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return Response.json({ success: false, code: 400, message: "Giới hạn phải từ 1 đến 50.", result: null }, { status: 400 });
  return stockRead(request, `/api/v1/inventory/stock-summary?limit=${limit}`);
}
