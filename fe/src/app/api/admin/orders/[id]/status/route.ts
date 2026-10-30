import type { NextRequest } from "next/server";
import { positiveId } from "@/lib/server/admin-stock";
import { patchOrderStatus } from "@/lib/server/admin-order";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const n = positiveId(id);
  return n ? patchOrderStatus(request, n) : Response.json({ success: false, code: 400, message: "Mã đơn chưa hợp lệ.", result: null }, { status: 400 });
}
