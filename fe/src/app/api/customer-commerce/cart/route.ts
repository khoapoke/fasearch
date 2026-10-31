import type { NextRequest } from "next/server";
import { commerceUpstream } from "@/lib/server/customer-commerce";
import { requireJsonPost } from "@/lib/server/customer-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return commerceUpstream(request, "/api/v1/cart", { method: "GET" });
}

export async function DELETE(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  return commerceUpstream(request, "/api/v1/cart", { method: "DELETE", body: {} });
}
