import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { promotionsUpstream, promotionId } from "@/lib/server/promotions-bff";
import { policyBody } from "@/lib/server/loyalty-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ policyId: string }> }) {
  const { policyId: raw } = await params;
  const policyId = promotionId(raw);
  if (!policyId) return Response.json({ success: false, code: 400, message: "Mã chính sách chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return Response.json({ success: false, code: 400, message: "Thông tin chính sách chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  const body = policyBody(parsed.body, false);
  if (!body) return Response.json({ success: false, code: 400, message: "Thông tin chính sách chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return promotionsUpstream(request, `/api/v1/thanh-vien/chinh-sach/${policyId}`, "PUT", body);
}
