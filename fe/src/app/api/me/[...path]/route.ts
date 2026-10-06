import { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";
import { libraryBackendPath } from "@/lib/library-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
  method: "GET" | "PUT" | "PATCH" | "DELETE",
) {
  const params = await context.params;
  const target = libraryBackendPath(params.path, new URL(request.url).search);
  if (!target) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "Đường dẫn thư viện không hợp lệ." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if ((method === "PUT" || method === "PATCH") && request.headers.get("content-type")) {
    const body = await request.text();
    return forwardSessionRequest(request, target, method, body, "application/json");
  }
  return forwardSessionRequest(request, target, method);
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context, "GET");
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context, "PUT");
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context, "PATCH");
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context, "DELETE");
}
