import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, requestAborted, requireJsonPost } from "@/lib/server/customer-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  if (request.signal.aborted) return requestAborted();
  const out = NextResponse.json({ success: true });
  clearAuthCookie(out, request);
  return out;
}
