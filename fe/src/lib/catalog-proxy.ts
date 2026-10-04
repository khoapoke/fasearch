/** Thin catalog read proxy with one validated trace for every failure path. */
const TRACE = /^[A-Za-z0-9._:-]{1,128}$/;

export async function proxyCatalogGet(request: Request, backendUrl: string, path: string): Promise<Response> {
  const incoming = request.headers.get("x-trace-id");
  const valid = incoming !== null && TRACE.test(incoming);
  const traceId = valid ? incoming : crypto.randomUUID();
  const headers = { "X-Trace-Id": traceId, "Cache-Control": "no-store" };
  if (incoming !== null && !valid) {
    return Response.json({ schema_version: "1.0.0", trace_id: traceId, code: "INVALID_REQUEST",
      message: "Mã tra cứu không hợp lệ." }, { status: 400, headers });
  }
  try {
    const query = new URL(request.url).search;
    const response = await fetch(`${backendUrl}${path}${query}`, {
      headers: { "X-Trace-Id": traceId }, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    const upstreamTrace = response.headers.get("x-trace-id");
    return new Response(await response.text(), {
      status: response.status,
      headers: { ...headers, "X-Trace-Id": upstreamTrace && TRACE.test(upstreamTrace) ? upstreamTrace : traceId,
        "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ schema_version: "1.0.0", trace_id: traceId, code: "BACKEND_UNAVAILABLE",
      message: "Không thể kết nối hệ thống catalog. Hãy thử lại sau." }, { status: 502, headers });
  }
}
