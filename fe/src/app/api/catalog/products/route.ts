import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

// Thin same-origin proxy for public catalog pagination. Forwards the validated
// query string untouched (Boot owns strict validation), generates one trace
// identity when the caller omits it, and always answers no-store.
export async function GET(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const query = request.nextUrl.search;

  try {
    const response = await fetch(
      `${backendUrl}/api/v1/catalog/products${query}`,
      {
        headers: { "X-Trace-Id": traceId },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

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
