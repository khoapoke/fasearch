import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

// Same-origin proxy for the public stateless image exception turned
// session-aware: forwards the HttpOnly session cookie and the page-memory
// CSRF token exactly like TEXT/COMPOSED, so an opted-in account search can
// record history on a CSRF-validated request. Guests fetch a token too
// (token is not login), stay anonymous, and never record history.
export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

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
      { status: 400, headers: { "X-Trace-Id": traceId } },
    );
  }
  const headers = new Headers({ "X-Trace-Id": traceId });
  const sessionId = request.cookies.get("FASEARCH_SESSION")?.value;
  if (sessionId) headers.set("cookie", `FASEARCH_SESSION=${sessionId}`);
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) headers.set("x-csrf-token", csrf);

  try {
    const response = await fetch(`${backendUrl}/api/v1/search/image`, {
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
      { status: 502, headers: { "X-Trace-Id": traceId } },
    );
  }
}
