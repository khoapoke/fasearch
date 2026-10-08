import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/catalog/drafts/[productId]/versions/[versionId]/image">,
) {
  const { productId, versionId } = await context.params;
  return forwardSessionRequest(request,
    `/api/v1/catalog/admin/drafts/${encodeURIComponent(productId)}`
    + `/versions/${encodeURIComponent(versionId)}/image`, "GET");
}
