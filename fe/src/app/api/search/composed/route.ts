import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

// Spring `max-request-size: 11MB` envelope plus the 10 MiB image cap. The
// declared-length pre-check rejects non-chunked over-envelope bodies before
// parsing; bodies without a trustworthy length are streamed with the same
// bound BEFORE formData buffering, so a chunked flood cannot force full
// buffering here — Boot still enforces its own envelope guard downstream.
const MAX_ENVELOPE_BYTES = 11 * 1024 * 1024;

// Bounded raw read: stops at cap+1 bytes and lets the caller reject early.
// Returns null when the body exceeds the cap (reader cancelled, no spill).
async function readBoundedBody(body: ReadableStream<Uint8Array> | null, cap: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        try { await reader.cancel(); } catch { /* already closed */ }
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

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

  // Bounded pre-buffer guard: consume the stream with an early stop so a
  // missing/chunked length cannot force full buffering before the 413.
  const bounded = await readBoundedBody(request.body, MAX_ENVELOPE_BYTES);
  if (bounded === null) {
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
    const contentType = request.headers.get("content-type") ?? "multipart/form-data";
    const replay = new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bounded as unknown as BodyInit });
    formData = await replay.formData();
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
        "X-History-Status": response.headers.get("x-history-status") ?? "NOT_RECORDED",
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
