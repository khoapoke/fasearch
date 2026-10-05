import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.text();
  return forwardSessionRequest(request, "/api/v1/auth/register", "POST",
    body, request.headers.get("content-type") ?? "application/json");
}
