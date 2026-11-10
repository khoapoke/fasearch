import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return forwardSessionRequest(request, "/api/v1/auth/me", "GET");
}
