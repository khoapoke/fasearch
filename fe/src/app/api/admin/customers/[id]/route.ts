import type { NextRequest } from "next/server";
import { customerRead, customerWrite, idOf } from "@/lib/server/admin-customer";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? customerRead(request, `/api/v1/users/customers/${n}`) : Response.json({ success: false, code: 400, message: "Mã khách hàng chưa hợp lệ.", result: null }, { status: 400 }); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? customerWrite(request, `/api/v1/users/customers/${n}`, "PATCH", false) : Response.json({ success: false, code: 400, message: "Mã khách hàng chưa hợp lệ.", result: null }, { status: 400 }); }
