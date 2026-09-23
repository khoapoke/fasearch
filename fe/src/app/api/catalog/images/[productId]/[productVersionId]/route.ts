import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/catalog/images/[productId]/[productVersionId]">,
) {
  const { productId, productVersionId } = await context.params;

  try {
    const url = `${backendUrl}/api/v1/catalog/images/${encodeURIComponent(productId)}/${encodeURIComponent(productVersionId)}`;
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return new Response(null, { status: response.status === 404 ? 404 : 502 });
    }
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (!contentType || !allowedTypes.has(contentType)) {
      return new Response(null, { status: 502 });
    }
    return new Response(response.body, {
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
