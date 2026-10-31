import type { NextRequest } from "next/server";
import { promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return promotionsUpstream(request, "/api/v1/thanh-vien/chinh-sach/hang", "GET");
}
