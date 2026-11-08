import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { promotionsUpstream } from "@/lib/server/promotions-bff";
import { campaignBody } from "@/lib/server/promotions-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = (message: string, status: number, code: string) => Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const page = source.get("page") ?? "0";
  const size = source.get("size") ?? "10";
  if (!/^\d+$/.test(page) || Number(page) > 2_147_483_647 || !/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 100) {
    return bad("Bộ lọc trang chưa hợp lệ.", 400, "INVALID_REQUEST");
  }
  const status = source.get("trangThai") ?? "";
  const effective = source.get("hieuLuc") ?? "";
  const type = source.get("loai") ?? "";
  const query = (source.get("q") ?? "").trim();
  if ((status && !["HOAT_DONG", "TAM_DUNG"].includes(status)) || (effective && !["DANG_CHAY", "TAM_DUNG", "DA_KET_THUC", "CHUA_BAT_DAU"].includes(effective)) || (type && !["PHAN_TRAM", "SO_TIEN"].includes(type)) || query.length > 100) {
    return bad("Bộ lọc chưa hợp lệ.", 400, "INVALID_REQUEST");
  }
  const qs = new URLSearchParams({ page, size });
  if (status) qs.set("trangThai", status);
  if (effective) qs.set("hieuLuc", effective);
  if (type) qs.set("loai", type);
  if (query) qs.set("q", query);
  return promotionsUpstream(request, `/api/v1/khuyen-mai?${qs}`, "GET");
}

export async function POST(request: NextRequest) {
  const parsed = await readBoundedJsonObject(request, 32 * 1024);
  if (!parsed.ok) return bad(parsed.reason === "TOO_LARGE" ? "Dữ liệu gửi lên vượt quá giới hạn." : "Dữ liệu gửi lên chưa hợp lệ.", parsed.reason === "TOO_LARGE" ? 413 : 400, parsed.reason === "TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST");
  const body = campaignBody(parsed.body, true);
  if (!body) return bad("Thông tin chiến dịch chưa hợp lệ.", 400, "INVALID_REQUEST");
  return promotionsUpstream(request, "/api/v1/khuyen-mai", "POST", body);
}
