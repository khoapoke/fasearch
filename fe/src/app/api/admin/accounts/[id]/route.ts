import type { NextRequest } from "next/server";
import { accountUpdate, idOf } from "@/lib/server/admin-people";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? accountUpdate(request, n) : Response.json({ success: false, code: 400, message: "Mã tài khoản chưa hợp lệ.", result: null }, { status: 400 }); }
