import type { NextRequest } from "next/server";
import { adminRead } from "@/lib/server/admin-bff";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ success: false, message: "Mã hoạt động không hợp lệ." }, { status: 400 });
  return adminRead(request, `/api/v1/admin/audit/${id}`);
}
