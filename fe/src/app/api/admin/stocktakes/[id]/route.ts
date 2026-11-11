import type { NextRequest } from "next/server";
import { positiveId } from "@/lib/server/admin-stock";
import { stocktakeRead } from "@/lib/server/admin-stocktake";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const n = positiveId(id);
  return n ? stocktakeRead(request, `/api/v1/inventory/stocktakes/${n}`) : Response.json({ success: false, code: 400, message: "Mã phiếu chưa hợp lệ.", result: null }, { status: 400 });
}
