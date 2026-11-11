import type { NextRequest } from "next/server";
import { adminIdentity } from "@/lib/server/admin-bff";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { commerceUpstream } from "@/lib/server/customer-commerce";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rejected = requireJsonPost(request); if (rejected) return rejected;
  const { id } = await context.params;
  if (!/^[1-9][0-9]*$/.test(id)) return Response.json({ message: "Mã thông báo không hợp lệ." }, { status: 400 });
  const who = await adminIdentity(request); if ("response" in who) return who.response;
  const parsed = await readBoundedJsonObject(request, 1024);
  if (!parsed.ok) return Response.json({ message: "Nội dung không hợp lệ." }, { status: 400 });
  return commerceUpstream(request, `/api/v1/admin/notifications/${id}/read`, { method: "POST", body: {}, safeErrors: true });
}
