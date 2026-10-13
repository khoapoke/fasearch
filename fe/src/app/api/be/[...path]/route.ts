import type { NextRequest } from "next/server";
import { buildUpstreamHeaders } from "@/lib/server/be-headers";

const backendUrl = process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:18083";

/**
 * Proxy chung FE → BE cho các trang quản trị + catalog (CONTRACT §8).
 * Forward session cookie + CSRF, stream body (kể cả multipart), giữ nguyên
 * status/envelope để client thấy đúng 401/403/404/409 của BE.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, method: string): Promise<Response> {
  const segments = request.nextUrl.pathname.replace(/^\/api\/be\//, "");
  const search = request.nextUrl.search;
  const target = `${backendUrl}/api/${segments}${search}`;

  const headers = buildUpstreamHeaders(
    request.headers,
    request.cookies.get("FASEARCH_SESSION")?.value,
  );

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 0) body = buffer;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return Response.json(
      { success: false, code: 502, message: "Không thể kết nối hệ thống.", result: null },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const out = new Headers({ "cache-control": "no-store" });
  const contentType = upstream.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) out.set("content-disposition", disposition);
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export async function GET(request: NextRequest) {
  return proxy(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxy(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return proxy(request, "PATCH");
}

export async function PUT(request: NextRequest) {
  return proxy(request, "PUT");
}

export async function DELETE(request: NextRequest) {
  return proxy(request, "DELETE");
}
