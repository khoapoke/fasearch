import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

// Spring `max-request-size: 11MB` envelope plus the 10 MiB image cap. The
// declared-length pre-check rejects non-chunked over-envelope bodies before
// parsing; chunked bodies without a length fall through to the Boot envelope
// guard, whose 413 is propagated below with the same safe shape.
const MAX_ENVELOPE_BYTES = 11 * 1024 * 1024;

// Thin same-origin proxy for live composed search. Unlike the public
// stateless image exception, this route keeps the ADR 0001 session contract:
// it forwards the HttpOnly session cookie and the page-memory CSRF token,
// generates one trace identity when the caller omits it, and never rewrites
// the multipart body.
export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const noStoreHeaders = { "X-Trace-Id": traceId, "Cache-Control": "no-store" };

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_ENVELOPE_BYTES) {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "IMAGE_TOO_LARGE",
        message: "Yêu cầu vượt quá giới hạn 11 MiB.",
      },
      { status: 413, headers: noStoreHeaders },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "INVALID_REQUEST",
        message: "Yêu cầu multipart không hợp lệ.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const headers = new Headers({ "X-Trace-Id": traceId });
  const sessionId = request.cookies.get("FASEARCH_SESSION")?.value;
  if (sessionId) headers.set("cookie", `FASEARCH_SESSION=${sessionId}`);
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) headers.set("x-csrf-token", csrf);

  try {
    const response = await fetch(`${backendUrl}/api/v1/search/composed`, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
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
        message: "Không thể kết nối hệ thống tìm kiếm. Hãy thử lại sau.",
      },
      { status: 502, headers: noStoreHeaders },
    );
  }
}
