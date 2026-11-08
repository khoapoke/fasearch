import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { codeBody } from "@/lib/server/promotions-validation";
import { promotionId, promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string, status: number, code: string) => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const id = promotionId((await params).id);
  if (!id) return bad("Mã chiến dịch chưa hợp lệ.", 400, "INVALID_REQUEST");
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu gửi lên vượt quá giới hạn." : "Dữ liệu gửi lên chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason === "TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST");
  const body = codeBody(parsed.body);
  if (!body) return bad("Thông tin phát hành Voucher chưa hợp lệ.", 400, "INVALID_REQUEST");
  return promotionsUpstream(request, `/api/v1/khuyen-mai/${id}/codes`, "POST", body);
}
