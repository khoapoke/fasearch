import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return forwardSessionRequest(request, "/api/v1/auth/logout", "POST",
    new URLSearchParams(), "application/x-www-form-urlencoded");
}
