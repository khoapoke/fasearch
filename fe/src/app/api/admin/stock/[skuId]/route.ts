import type { NextRequest } from "next/server";
import { positiveId, stockRead } from "@/lib/server/admin-stock";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ skuId: string }> }) { const { skuId } = await params; const id = positiveId(skuId); return id ? stockRead(request, `/api/v1/inventory/stock/${id}`) : Response.json({ success: false, code: 400, message: "SKU chưa hợp lệ.", result: null }, { status: 400 }); }
