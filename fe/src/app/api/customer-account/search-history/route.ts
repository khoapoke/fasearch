import type { NextRequest } from "next/server";
import { accountUpstream } from "@/lib/server/customer-account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.toString();
  return accountUpstream(request, `/api/v1/account/search-history${q ? `?${q}` : ""}`, { method: "GET" });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return accountUpstream(request, "/api/v1/account/search-history", { method: "POST", body });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ success: false, code: 400, message: "Thiếu id.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return accountUpstream(request, `/api/v1/account/search-history/${id}`, { method: "DELETE" });
}
