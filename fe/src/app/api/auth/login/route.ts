import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let payload: { username?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (typeof payload.username !== "string" || typeof payload.password !== "string") {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }
  const form = new URLSearchParams({
    username: payload.username,
    password: payload.password,
  });
  return forwardSessionRequest(request, "/api/v1/auth/login", "POST", form,
    "application/x-www-form-urlencoded");
}
