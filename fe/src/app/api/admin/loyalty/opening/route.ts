import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  const customerId = parsed.ok ? parsed.body.customerId : null;
  if (!Number.isSafeInteger(customerId) || (customerId as number) <= 0) return Response.json({ success: false, code: 400, message: "Mã khách hàng chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return promotionsUpstream(request, "/api/v1/quan-tri/thanh-vien/mo-dau", "POST", { customerId });
}
