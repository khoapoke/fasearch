import type { NextRequest } from "next/server";
import { accountUpstream } from "@/lib/server/customer-account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.toString();
  return accountUpstream(request, `/api/v1/account/favorites${q ? `?${q}` : ""}`, { method: "GET" });
}

export async function POST(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) return Response.json({ success: false, code: 400, message: "Thiếu productId.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return accountUpstream(request, `/api/v1/account/favorites?productId=${encodeURIComponent(productId)}`, { method: "POST" });
}

export async function DELETE(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) return Response.json({ success: false, code: 400, message: "Thiếu productId.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return accountUpstream(request, `/api/v1/account/favorites/${encodeURIComponent(productId)}`, { method: "DELETE" });
}
