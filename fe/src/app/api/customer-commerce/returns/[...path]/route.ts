import type { NextRequest } from "next/server";
import { commerceUpstream } from "@/lib/server/customer-commerce";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!/^(orders\/[1-9][0-9]*|[1-9][0-9]*(\/photos\/[0-2])?)$/.test(path.join("/"))) return Response.json({ message: "Đường dẫn không hợp lệ." }, { status: 400 });
  return commerceUpstream(request, `/api/v1/returns/${path.join("/")}`, { method: "GET", safeErrors: true });
}
