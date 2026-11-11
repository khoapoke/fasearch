import type { NextRequest } from "next/server";
import { commerceUpstream } from "@/lib/server/customer-commerce";
import { authError } from "@/lib/server/customer-auth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("placeId") ?? "";
  if (!value.trim() || value.length > 200) return authError("Địa chỉ chưa hợp lệ.", 400, "INVALID_ADDRESS");
  return commerceUpstream(request, `/api/v1/shipping/maps/geocode?placeId=${encodeURIComponent(value)}`, { method: "GET", safeErrors: true });
}
