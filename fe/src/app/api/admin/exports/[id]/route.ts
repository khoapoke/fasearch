import type { NextRequest } from "next/server";
import { positiveId, stockRead } from "@/lib/server/admin-stock";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = positiveId(id); return n ? stockRead(request, `/api/v1/inventory/export-receipts/${n}`) : Response.json({ success: false, code: 400, message: "Mã phiếu chưa hợp lệ.", result: null }, { status: 400 }); }
