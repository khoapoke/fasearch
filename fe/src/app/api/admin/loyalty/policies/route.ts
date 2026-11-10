import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { promotionsUpstream } from "@/lib/server/promotions-bff";
import { policyBody } from "@/lib/server/loyalty-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = () => Response.json({ success: false, code: 400, message: "Thông tin chính sách điểm chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const page = source.get("page") ?? "0";
  const size = source.get("size") ?? "20";
  if (!/^\d+$/.test(page) || Number(page) > 2_147_483_647 || !/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 100) return bad();
  return promotionsUpstream(request, `/api/v1/thanh-vien/chinh-sach?page=${page}&size=${size}`, "GET");
}

export async function POST(request: NextRequest) {
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return bad();
  const body = policyBody(parsed.body, true);
  if (!body) return bad();
  return promotionsUpstream(request, "/api/v1/thanh-vien/chinh-sach", "POST", body);
}
