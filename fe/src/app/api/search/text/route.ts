import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

// JSON body cap 16 KiB before full parsing, for declared-length and chunked
// bodies alike. Mirrors the Boot/AI TEXT bound; chunked bodies without a
// length fall through to the raw-text check below.
const MAX_JSON_BYTES = 16 * 1024;

// Thin same-origin proxy for TEXT search. Keeps the ADR 0001 session
// contract: forwards the HttpOnly session cookie and the page-memory CSRF
// token, generates one trace identity when the caller omits it, applies the
// 16 KiB cap before JSON parsing, and never logs the query body.
export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const noStoreHeaders = { "X-Trace-Id": traceId, "Cache-Control": "no-store" };

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_JSON_BYTES) {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "INVALID_REQUEST",
        message: "Yêu cầu vượt quá giới hạn 16 KiB.",
      },
      { status: 413, headers: noStoreHeaders },
    );
  }

  // Bounded pre-buffer guard: stream with an early 16 KiB stop so a
  // chunked/missing-length body cannot force full text buffering.
  async function readBoundedText(): Promise<string | null> {
    const stream = request.body;
    if (!stream) return "";
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_JSON_BYTES) {
          try { await reader.cancel(); } catch { /* already closed */ }
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))),
    );
  }

  let raw: string;
  try {
    const bounded = await readBoundedText();
    if (bounded === null) throw new RangeError("body too large");
    raw = bounded;
  } catch (error) {
    if (error instanceof RangeError) {
      return Response.json(
        {
          schema_version: "1.0.0",
          trace_id: traceId,
          code: "INVALID_REQUEST",
          message: "Yêu cầu vượt quá giới hạn 16 KiB.",
        },
        { status: 413, headers: noStoreHeaders },
      );
    }
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "INVALID_REQUEST",
        message: "Yêu cầu JSON không hợp lệ.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (new TextEncoder().encode(raw).length > MAX_JSON_BYTES) {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "INVALID_REQUEST",
        message: "Yêu cầu vượt quá giới hạn 16 KiB.",
      },
      { status: 413, headers: noStoreHeaders },
    );
  }
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "INVALID_REQUEST",
        message: "Yêu cầu JSON không hợp lệ.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "INVALID_REQUEST",
        message: "Yêu cầu JSON không hợp lệ.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  const queryText = (payload as { query_text?: unknown }).query_text;
  if (typeof queryText === "string" && LONE_SURROGATE.test(queryText)) {
    return Response.json(
      {
        schema_version: "1.0.0",
        trace_id: traceId,
        code: "INVALID_REQUEST",
        message: "Mô tả tìm kiếm chứa ký tự không hợp lệ.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const headers = new Headers({
    "X-Trace-Id": traceId,
    "Content-Type": "application/json",
  });
  const sessionId = request.cookies.get("FASEARCH_SESSION")?.value;
  if (sessionId) headers.set("cookie", `FASEARCH_SESSION=${sessionId}`);
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) headers.set("x-csrf-token", csrf);

  try {
    const response = await fetch(`${backendUrl}/api/v1/search/text`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
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
