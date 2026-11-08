import type { NextRequest } from "next/server";
import { accountDelete, accountUpdate, idOf } from "@/lib/server/admin-people";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? accountUpdate(request, n) : Response.json({ success: false, code: 400, message: "Mã tài khoản chưa hợp lệ.", result: null }, { status: 400 }); }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? accountDelete(request, n) : Response.json({ success: false, code: 400, message: "Mã tài khoản chưa hợp lệ.", result: null }, { status: 400 }); }
