import { NextRequest, NextResponse } from "next/server";
import { authError, clearAuthCookie, hasAuthAttempt, requestAborted, requireJsonPost } from "@/lib/server/customer-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  if (request.signal.aborted) return requestAborted();
  if (!hasAuthAttempt(request)) return authError("Phiên đăng xuất chưa sẵn sàng. Tải lại trang rồi thử lại.", 400, "AUTH_ATTEMPT_REQUIRED");
  const out = NextResponse.json({ success: true });
  clearAuthCookie(out, request);
  return out;
}
