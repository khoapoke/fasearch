import type { NextRequest } from "next/server";
import { employeeGet, employeeUpdate, idOf } from "@/lib/server/admin-people";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? employeeGet(request, n) : Response.json({ success: false, code: 400, message: "Mã hồ sơ nhân sự chưa hợp lệ.", result: null }, { status: 400 }); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? employeeUpdate(request, n) : Response.json({ success: false, code: 400, message: "Mã hồ sơ nhân sự chưa hợp lệ.", result: null }, { status: 400 }); }
