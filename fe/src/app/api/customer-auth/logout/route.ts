import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, requireJsonPost } from "@/lib/server/customer-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const out = NextResponse.json({ success: true });
  clearAuthCookie(out);
  return out;
}
