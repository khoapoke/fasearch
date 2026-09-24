import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/catalog/drafts/[productId]">,
) {
  const { productId } = await context.params;
  return forwardSessionRequest(request,
    `/api/v1/catalog/admin/drafts/${encodeURIComponent(productId)}`, "GET");
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/catalog/drafts/[productId]">,
) {
  const { productId } = await context.params;
  return forwardSessionRequest(request,
    `/api/v1/catalog/admin/drafts/${encodeURIComponent(productId)}`, "PATCH",
    await request.text(), "application/json");
}
