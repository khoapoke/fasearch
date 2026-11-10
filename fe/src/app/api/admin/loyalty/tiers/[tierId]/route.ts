import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { promotionsUpstream, promotionId } from "@/lib/server/promotions-bff";
import { tierBody } from "@/lib/server/loyalty-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
  const { tierId: raw } = await params;
  const tierId = promotionId(raw);
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!tierId || !parsed.ok) return Response.json({ success: false, code: 400, message: "Thông tin ngưỡng hạng chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  const body = tierBody(parsed.body);
  if (!body) return Response.json({ success: false, code: 400, message: "Thông tin ngưỡng hạng chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return promotionsUpstream(request, `/api/v1/thanh-vien/chinh-sach/hang/${tierId}`, "PUT", body);
}
