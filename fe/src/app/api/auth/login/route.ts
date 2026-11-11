import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

// New BE contract uses a JSON login DTO — pass the body straight through
// (the old form-urlencoded conversion belonged to the previous backend).
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
  return forwardSessionRequest(
    request,
    "/api/v1/auth/login",
    "POST",
    JSON.stringify({ username: payload.username, password: payload.password }),
    "application/json",
  );
}
