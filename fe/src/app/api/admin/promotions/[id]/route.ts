import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { campaignBody } from "@/lib/server/promotions-validation";
import { promotionId, promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string, status: number, code: string) => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const id = promotionId((await params).id);
  return id ? promotionsUpstream(request, `/api/v1/khuyen-mai/${id}`, "GET") : bad("Mã chiến dịch chưa hợp lệ.", 400, "INVALID_REQUEST");
}

export async function PUT(request: NextRequest, { params }: Context) {
  const id = promotionId((await params).id);
  if (!id) return bad("Mã chiến dịch chưa hợp lệ.", 400, "INVALID_REQUEST");
  const parsed = await readBoundedJsonObject(request, 32 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu gửi lên vượt quá giới hạn." : "Dữ liệu gửi lên chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason === "TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST");
  const body = campaignBody(parsed.body, false);
  if (!body || Object.keys(body).length < 2) return bad("Thông tin cập nhật chưa hợp lệ.", 400, "INVALID_REQUEST");
  return promotionsUpstream(request, `/api/v1/khuyen-mai/${id}`, "PUT", body);
}
