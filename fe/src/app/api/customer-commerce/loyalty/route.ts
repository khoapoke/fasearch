import type { NextRequest } from "next/server";
import { commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return commerceUpstream(request, "/api/v1/thanh-vien", { method: "GET" });
}
