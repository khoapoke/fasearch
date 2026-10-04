import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

// Thin same-origin proxy for public catalog detail. Forwards the validated
// expected-context query (product_version_id + catalog_snapshot_id,
// both-or-neither) untouched; Boot owns strict validation.
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/catalog/products/[productId]">,
) {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { productId } = await context.params;
  const query = request.nextUrl.search;

  try {
    const url =
      `${backendUrl}/api/v1/catalog/products/${encodeURIComponent(productId)}${query}`;
    const response = await fetch(url, {
      headers: { "X-Trace-Id": traceId },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
        "X-Trace-Id": response.headers.get("x-trace-id") ?? traceId,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "BACKEND_UNAVAILABLE",
        message: "Không thể kết nối hệ thống catalog. Hãy thử lại sau.",
      },
      { status: 502, headers: { "X-Trace-Id": traceId, "Cache-Control": "no-store" } },
    );
  }
}
