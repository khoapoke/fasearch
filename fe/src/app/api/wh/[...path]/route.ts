import type { NextRequest } from "next/server";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { buildUpstreamHeaders } from "@/lib/server/be-headers";
import { parseBackendBase, whRequestHeaders, whResponseHeaders } from "@/lib/server/wh-forward";

function warehouseBase() {
  return parseBackendBase(process.env.FASEARCH_WAREHOUSE_URL ?? "http://127.0.0.1:18084");
}

/**
 * Proxy FE → BE kho (D057–D059, CONTRACT inventory-core).
 * Dùng node:http(s) trực tiếp thay vì fetch vì runtime kho treo mọi request
 * mang header `Accept-Language` (fetch/undici luôn gửi `Accept-Language: *`
 * và Headers.delete bị lờ — đã chứng minh bằng listener TCP + curl từng
 * header). Header này bị lược ở đây; parity còn lại như proxy /api/be:
 * session cookie + CSRF forward, giữ nguyên status/body/query,
 * content-type, set-cookie, location; timeout 20s; không tự redirect.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function upstream(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: Buffer,
): Promise<{ status: number; headers: Record<string, string | string[]>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const base = warehouseBase();
    const send = base.protocol === "https:" ? httpsRequest : httpRequest;
    const req = send(
      {
        host: base.host,
        port: base.port,
        path: `/api/${path}`,
        method,
        headers: { ...headers, connection: "close" },
        timeout: 20_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 502,
            headers: res.headers as Record<string, string | string[]>,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("upstream timeout")));
    req.on("error", reject);
    if (body && body.length > 0) req.write(body);
    req.end();
  });
}

async function proxy(request: NextRequest, method: string): Promise<Response> {
  const segments = request.nextUrl.pathname.replace(/^\/api\/wh\//, "");
  const search = request.nextUrl.search;
  // Xem ghi chú đầu file: runtime kho treo với mọi Accept-Language.
  const headers = whRequestHeaders(
    buildUpstreamHeaders,
    request.headers,
    request.cookies.get("FASEARCH_SESSION")?.value,
  );

  const outgoing: Record<string, string> = {};
  headers.forEach((value, key) => {
    outgoing[key] = value;
  });

  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.length > 0) body = buffer;
  }

  try {
    const up = await upstream(method, `${segments}${search}`, outgoing, body);
    const kept = whResponseHeaders(up.headers);
    const out = new Headers({ "cache-control": "no-store" });
    if (kept.contentType) out.set("content-type", kept.contentType);
    if (kept.location) out.set("location", kept.location);
    for (const cookie of kept.cookies) out.append("set-cookie", cookie);
    return new Response(up.status === 204 ? null : new Uint8Array(up.body), {
      status: up.status,
      headers: out,
    });
  } catch {
    return Response.json(
      { success: false, code: 502, message: "Không thể kết nối hệ thống kho.", result: null },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
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
