import type { NextRequest } from "next/server";

const backendUrl =
  process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:18082";

export async function forwardSessionRequest(
  request: NextRequest,
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  body?: BodyInit,
  contentType?: string,
): Promise<Response> {
  const headers = new Headers();
  const sessionId = request.cookies.get("FASEARCH_SESSION")?.value;
  const csrf = request.headers.get("x-csrf-token");
  if (sessionId) headers.set("cookie", `FASEARCH_SESSION=${sessionId}`);
  if (csrf) headers.set("x-csrf-token", csrf);
  if (body !== undefined && contentType) headers.set("content-type", contentType);

  try {
    const upstream = await fetch(`${backendUrl}${path}`, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    const responseType = upstream.headers.get("content-type");
    if (responseType) responseHeaders.set("content-type", responseType);
    const nosniff = upstream.headers.get("x-content-type-options");
    if (nosniff) responseHeaders.set("x-content-type-options", nosniff);
    const location = upstream.headers.get("location");
    if (location && upstream.status === 201) responseHeaders.set("location", location);
    for (const value of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", value);
    }
    return new Response(upstream.status === 204 ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { code: "BACKEND_UNAVAILABLE", message: "Không thể kết nối hệ thống." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
