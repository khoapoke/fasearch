import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const suffix = query ? `?${query}` : "";
  return forwardSessionRequest(request, `/api/v1/catalog/admin/drafts${suffix}`, "GET");
}

export async function POST(request: NextRequest) {
  return forwardSessionRequest(request, "/api/v1/catalog/admin/drafts", "POST",
    await request.text(), "application/json");
}
