import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/catalog/drafts/[productId]/versions">,
) {
  const { productId } = await context.params;
  const query = request.nextUrl.searchParams.toString();
  const suffix = query ? `?${query}` : "";
  return forwardSessionRequest(request,
    `/api/v1/catalog/admin/drafts/${encodeURIComponent(productId)}/versions${suffix}`, "GET");
}
